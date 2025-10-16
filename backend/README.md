# Belved Hair Booking – Backend (FastAPI)

## Voraussetzungen
- Python 3.10+
- PostgreSQL (z. B. Supabase) mit Schema aus `schema.sql`

## Setup
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Werte anpassen
uvicorn main:app --reload --port 8000
```
Backend läuft dann auf `http://localhost:8000`.

## ENV
- `DATABASE_URL` – Postgres/Supabase URL
- `SHOP_TZ` – z. B. Europe/Vienna
- `CORS_ORIGINS` – z. B. http://localhost:5173
- `ADMIN_USER`, `ADMIN_PASS` – HTTP Basic für Admin-Endpoints

## Endpoints (öffentlich)
- `GET /barbers`
- `GET /month_overview?barber_id=&month=YYYY-MM`
- `GET /availability?barber_id=&d=YYYY-MM-DD`
- `POST /book` – { barber_id, start_ts_iso, customer_name, phone_e164 }
- `POST /priority_request` – { barber_id, desired_local_iso, customer_name, phone_e164, notes? }

## Endpoints (Admin, Basic-Auth)
- `GET /admin/bookings?frm=YYYY-MM-DD&to=YYYY-MM-DD&barber_id?=`
- `POST /admin/cancel?booking_id=`
- `POST /admin/time_off` (JSON: barber_id, start_local_iso, end_local_iso, reason?)
