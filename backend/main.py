import os, secrets, re
from datetime import datetime, date, time, timedelta
from calendar import monthrange
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
import psycopg
from psycopg.rows import dict_row

# -------- Environment --------
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL not set")
TZ = ZoneInfo(os.getenv("SHOP_TZ", "Europe/Vienna"))
SLOT_STEP_MIN = 15
DURATION_MIN = 30  # fixed haircut length

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "changeme")
security = HTTPBasic()

# -------- App & CORS --------
app = FastAPI(title="Belved Hair Booking API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

def db():
    with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
        yield conn

# -------- Models --------
class Barber(BaseModel):
    id: str; name: str; photo_url: str | None = None

class BookingIn(BaseModel):
    barber_id: str
    start_ts_iso: str   # 'YYYY-MM-DDTHH:MM' (local shop time)
    customer_name: str
    phone_e164: str

class TimeOffIn(BaseModel):
    barber_id: str
    start_local_iso: str
    end_local_iso: str
    reason: str | None = None

class PriorityIn(BaseModel):
    barber_id: str
    desired_local_iso: str
    customer_name: str
    phone_e164: str
    notes: str | None = None

# -------- Validation helpers --------
PHONE_RE = re.compile(r"^\+\d{8,15}$")

def assert_valid_name(name: str):
    if not name or not (2 <= len(name) <= 80):
        raise HTTPException(400, "Name ungültig")

def assert_valid_phone(p: str):
    if not PHONE_RE.match(p):
        raise HTTPException(400, "Telefon-Format: +43…")

def assert_future_local(dt_local: datetime):
    if dt_local < datetime.now(TZ) + timedelta(minutes=1):
        raise HTTPException(400, "Zeitpunkt liegt in der Vergangenheit")

# very simple in-memory rate limit per IP
_RATE = {}
def rate_limit(ip: str, limit:int=5, window:int=60):
    from time import time as now_time
    t = now_time()
    bucket = [x for x in _RATE.get(ip, []) if x > t - window]
    if len(bucket) >= limit: raise HTTPException(429, "Zu viele Anfragen")
    bucket.append(t); _RATE[ip] = bucket

# -------- Internal helpers --------
def local_day_bounds(d: date):
    start_local = datetime.combine(d, time.min).replace(tzinfo=TZ)
    end_local = datetime.combine(d, time.max).replace(tzinfo=TZ)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))

def default_service_id(conn) -> str:
    row = conn.execute("select id from services where name='Haarschnitt' and is_active=true limit 1").fetchone()
    if not row:
        raise HTTPException(500, "Default service 'Haarschnitt' fehlt")
    return row["id"]

def _busy_ranges(conn, barber_id: str, start_utc: datetime, end_utc: datetime):
    return conn.execute("""
      select start_ts as s, end_ts as e from time_off
      where barber_id=%s and tstzrange(start_ts,end_ts,'[)') && tstzrange(%s,%s,'[)')
      union all
      select start_ts as s, end_ts as e from bookings
      where barber_id=%s and status in ('pending','confirmed')
        and during && tstzrange(%s,%s,'[)')
    """,(barber_id, start_utc, end_utc, barber_id, start_utc, end_utc)).fetchall()

def _slots_for_day(conn, barber_id: str, day_local: date):
    weekday = day_local.isoweekday()
    wh = conn.execute("""
      select start_time, end_time from working_hours
      where barber_id=%s and weekday=%s
    """,(barber_id, weekday)).fetchall()
    if not wh: return []

    day_start_utc, day_end_utc = local_day_bounds(day_local)
    busy = _busy_ranges(conn, barber_id, day_start_utc, day_end_utc)

    def overlaps(s_utc: datetime, e_utc: datetime)->bool:
        for r in busy:
            if max(r["s"], s_utc) < min(r["e"], e_utc):
                return True
        return False

    slots = []
    for row in wh:
        start_local = datetime.combine(day_local, row["start_time"]).replace(tzinfo=TZ)
        end_local   = datetime.combine(day_local, row["end_time"]).replace(tzinfo=TZ)
        m = (start_local.minute // SLOT_STEP_MIN) * SLOT_STEP_MIN
        cur_local = start_local.replace(minute=m, second=0, microsecond=0)
        if cur_local < start_local:
            cur_local += timedelta(minutes=SLOT_STEP_MIN)
        while cur_local + timedelta(minutes=DURATION_MIN) <= end_local:
            s_utc = cur_local.astimezone(ZoneInfo("UTC"))
            e_utc = (cur_local + timedelta(minutes=DURATION_MIN)).astimezone(ZoneInfo("UTC"))
            if not overlaps(s_utc, e_utc):
                slots.append(cur_local.strftime("%H:%M"))
            cur_local += timedelta(minutes=SLOT_STEP_MIN)
    return sorted(list(set(slots)))

def require_admin(credentials: HTTPBasicCredentials = Depends(security)):
    ok_user = secrets.compare_digest(credentials.username, ADMIN_USER)
    ok_pass = secrets.compare_digest(credentials.password, ADMIN_PASS)
    if not (ok_user and ok_pass):
        raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate":"Basic"})
    return True

# -------- Public Endpoints --------
@app.get("/barbers", response_model=list[Barber])
def list_barbers(conn=Depends(db)):
    return conn.execute("select id, name, photo_url from barbers where is_active=true order by name").fetchall()

@app.get("/availability")
def availability(barber_id: str, d: str, conn=Depends(db)):
    try:
        day_local = datetime.strptime(d, "%Y-%m-%d").date()
    except:
        raise HTTPException(400, "Bad date")
    return {"slots": _slots_for_day(conn, barber_id, day_local), "date": d, "duration_min": DURATION_MIN}

@app.get("/month_overview")
def month_overview(barber_id: str, month: str, conn=Depends(db)):
    try:
        y, m = month.split("-")
        first = date(int(y), int(m), 1)
    except:
        raise HTTPException(400, "Bad month")
    days_in_month = monthrange(first.year, first.month)[1]
    today_local = datetime.now(TZ).date()
    out = []
    for d in range(1, days_in_month+1):
        day = date(first.year, first.month, d)
        if day < today_local:
            out.append({"date": day.isoformat(), "free": 0})
        else:
            free_slots = _slots_for_day(conn, barber_id, day)
            out.append({"date": day.isoformat(), "free": len(free_slots)})
    return {"month": month, "days": out}

@app.post("/book")
def book(data: BookingIn, request: Request, conn=Depends(db)):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    rate_limit(ip)

    assert_valid_name(data.customer_name)
    assert_valid_phone(data.phone_e164)

    try:
        local_dt = datetime.fromisoformat(data.start_ts_iso).replace(tzinfo=TZ)
    except:
        raise HTTPException(400, "start_ts_iso invalid")
    assert_future_local(local_dt)

    start_utc = local_dt.astimezone(ZoneInfo("UTC"))
    end_utc = start_utc + timedelta(minutes=DURATION_MIN)
    svc_id = default_service_id(conn)
    try:
        row = conn.execute("""
          insert into bookings (barber_id, service_id, customer_name, phone_e164, start_ts, end_ts, status)
          values (%s,%s,%s,%s,%s,%s,'confirmed')
          returning id
        """,(data.barber_id, svc_id, data.customer_name, data.phone_e164, start_utc, end_utc)).fetchone()
    except psycopg.errors.ExclusionViolation:
        raise HTTPException(409, "Slot already taken")
    return {"ok": True, "booking_id": row["id"]}

@app.post("/priority_request")
def priority_request(data: PriorityIn, request: Request, conn=Depends(db)):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    rate_limit(ip)

    assert_valid_name(data.customer_name)
    assert_valid_phone(data.phone_e164)

    try:
        desired_local = datetime.fromisoformat(data.desired_local_iso).replace(tzinfo=TZ)
    except:
        raise HTTPException(400, "desired_local_iso invalid")
    assert_future_local(desired_local)

    desired_utc = desired_local.astimezone(ZoneInfo("UTC"))
    svc_id = default_service_id(conn)
    row = conn.execute("""
      insert into priority_requests (barber_id, service_id, customer_name, phone_e164, email, desired_ts, notes)
      values (%s,%s,%s,%s,%s,%s,%s) returning id
    """,(data.barber_id, svc_id, data.customer_name, data.phone_e164, None, desired_utc, data.notes)).fetchone()
    return {"ok": True, "request_id": row["id"]}

# -------- Admin Endpoints --------
@app.get("/admin/bookings")
def admin_bookings(frm: str, to: str, barber_id: str|None=None, conn=Depends(db), _:bool=Depends(require_admin)):
    try:
        d1 = datetime.strptime(frm,"%Y-%m-%d").date()
        d2 = datetime.strptime(to,"%Y-%m-%d").date()
    except: raise HTTPException(400,"Bad dates")
    s_utc, _ = local_day_bounds(d1)
    _, e_utc = local_day_bounds(d2)
    q = """
      select b.id, b.customer_name, b.phone_e164, b.email, b.status,
             b.start_ts, b.end_ts,
             to_char((b.start_ts AT TIME ZONE 'UTC') AT TIME ZONE %s, 'YYYY-MM-DD HH24:MI') as start_local,
             to_char((b.end_ts   AT TIME ZONE 'UTC') AT TIME ZONE %s, 'YYYY-MM-DD HH24:MI') as end_local,
             ba.name as barber_name, s.name as service_name
      from bookings b
      join barbers ba on ba.id=b.barber_id
      join services s on s.id=b.service_id
      where b.during && tstzrange(%s,%s,'[)')
    """
    params = [TZ.key, TZ.key, s_utc, e_utc]
    if barber_id:
        q += " and b.barber_id=%s"; params.append(barber_id)
    q += " order by b.start_ts asc"
    return {"items": conn.execute(q, params).fetchall()}

@app.post("/admin/cancel")
def admin_cancel(booking_id: str, conn=Depends(db), _:bool=Depends(require_admin)):
    row = conn.execute("update bookings set status='cancelled' where id=%s returning id",(booking_id,)).fetchone()
    if not row: raise HTTPException(404,"Not found")
    return {"ok": True}

@app.post("/admin/time_off")
def admin_time_off(data: TimeOffIn, conn=Depends(db), _:bool=Depends(require_admin)):
    try:
        s_local = datetime.fromisoformat(data.start_local_iso).replace(tzinfo=TZ)
        e_local = datetime.fromisoformat(data.end_local_iso).replace(tzinfo=TZ)
    except: raise HTTPException(400,"Bad datetimes")
    if e_local <= s_local: raise HTTPException(400,"End must be after start")
    s_utc = s_local.astimezone(ZoneInfo("UTC")); e_utc = e_local.astimezone(ZoneInfo("UTC"))
    row = conn.execute("""
      insert into time_off (barber_id, start_ts, end_ts, reason)
      values (%s,%s,%s,%s) returning id
    """,(data.barber_id, s_utc, e_utc, data.reason)).fetchone()
    return {"ok": True, "id": row["id"]}
