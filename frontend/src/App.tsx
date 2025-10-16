import { useEffect, useMemo, useState } from "react";
import { getBarbers, getMonthOverview, getAvailability, book, priorityRequest } from "./api";
import Calendar from "./components/Calendar";
import Admin from "./components/Admin";

type Barber = { id:string; name:string; photo_url?:string };
const API = import.meta.env.VITE_API_URL as string;

function ym(d: Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

function pad(n:number){ return String(n).padStart(2,"0"); }
function fmtICS(dt: Date){
  // YYYYMMDDTHHMMSSZ (UTC)
  return dt.getUTCFullYear()
    + pad(dt.getUTCMonth()+1)
    + pad(dt.getUTCDate())
    + "T"
    + pad(dt.getUTCHours())
    + pad(dt.getUTCMinutes())
    + pad(dt.getUTCSeconds()) + "Z";
}
function downloadICS(barber:string, dateStr:string, timeStr:string){
  const startLocal = new Date(`${dateStr}T${timeStr}:00`);
  const endLocal = new Date(startLocal.getTime() + 30*60000);
  const dtStart = fmtICS(startLocal);
  const dtEnd   = fmtICS(endLocal);
  const uid = crypto.randomUUID();
  const now = fmtICS(new Date());

  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BelvedHair//Booking//DE
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:Haarschnitt bei ${barber}
DESCRIPTION:Buchung online bestätigt.
LOCATION:Belved Hair
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `termin-${dateStr}-${timeStr}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function gcalLink(barber:string, dateStr:string, timeStr:string){
  const startLocal = new Date(`${dateStr}T${timeStr}:00`);
  const endLocal = new Date(startLocal.getTime() + 30*60000);
  const start = fmtICS(startLocal);
  const end = fmtICS(endLocal);
  const text = encodeURIComponent(`Haarschnitt bei ${barber}`);
  const location = encodeURIComponent("Belved Hair");
  const details = encodeURIComponent("Online gebucht.");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&location=${location}&details=${details}`;
}

export default function App(){
  const [page,setPage]=useState<"book"|"admin">("book");
  const [step,setStep]=useState(1);

  const [barbers,setBarbers]=useState<Barber[]>([]);
  const [barberId,setBarberId]=useState<string>();

  const [month,setMonth]=useState<string>(ym(new Date()));
  const [days,setDays]=useState<{date:string; free:number}[]>([]);
  const [date,setDate]=useState<string>("");
  const [slots,setSlots]=useState<string[]>([]);
  const [time,setTime]=useState<string>("");

  const [name,setName]=useState(""); 
  const [phone,setPhone]=useState("");

  const [prioOpen,setPrioOpen]=useState(false);
  const [prioTime,setPrioTime]=useState("12:00");
  const [prioNote,setPrioNote]=useState("");

  const [consent,setConsent]=useState(false);
  const [hp,setHp]=useState(""); // honeypot

  const [ok,setOk]=useState<{barber?:string; dt?:string; id?:string}|null>(null);

  useEffect(()=>{(async()=>{
    const bs=await getBarbers(); setBarbers(bs);
  })();},[]);

  useEffect(()=>{(async()=>{
    if(barberId && month){
      const r = await getMonthOverview(barberId, month);
      setDays(r.days || []); setDate(""); setTime(""); setSlots([]); setPrioOpen(false);
    }
  })();},[barberId, month]);

  useEffect(()=>{(async()=>{
    if(barberId && date){
      const r = await getAvailability(barberId, date);
      setSlots(r.slots || []); setTime("");
    }
  })();},[barberId, date]);

  const canNext1 = !!barberId;
  const canNext2 = !!(date && time);
  const noFreeInMonth = useMemo(()=> days.length>0 && days.every(d=>d.free===0),[days]);
  const barberName = useMemo(()=> barbers.find(b=>b.id===barberId)?.name ?? "", [barbers,barberId]);

  async function submit(){
    if(hp){ return; }
    if(!name || !phone){ alert("Name & Telefon erforderlich."); return; }
    if(!consent){ alert("Bitte Datenschutz akzeptieren."); return; }
    const start_iso = `${date}T${time}`;
    const res = await book({barber_id:barberId!, start_ts_iso:start_iso, customer_name:name, phone_e164:phone});
    setOk({barber: barberName, dt:`${date} ${time}`, id: res.booking_id});
    // reset
    setStep(1); setBarberId(undefined); setDate(""); setTime(""); setSlots([]); setDays([]);
    setName(""); setPhone(""); setConsent(false);
  }

  async function submitPriority(){
    if(hp){ return; }
    if(!date){ alert("Bitte Datum wählen."); return; }
    if(!phone || !name){ alert("Name & Telefon erforderlich."); return; }
    if(!consent){ alert("Bitte Datenschutz akzeptieren."); return; }
    await priorityRequest({
      barber_id: barberId!, desired_local_iso: `${date}T${prioTime}`,
      customer_name: name, phone_e164: phone, notes: prioNote
    });
    setOk({barber: barberName, dt:`${date} ${prioTime}`});
    setStep(1); setBarberId(undefined); setDate(""); setTime(""); setSlots([]); setDays([]);
    setName(""); setPhone(""); setPrioOpen(false); setPrioNote(""); setPrioTime("12:00"); setConsent(false);
  }

  function prevMonth(){
    const [y,m]=month.split("-").map(Number);
    const d=new Date(y,m-1,1); d.setMonth(d.getMonth()-1); setMonth(ym(d));
  }
  function nextMonth(){
    const [y,m]=month.split("-").map(Number);
    const d=new Date(y,m-1,1); d.setMonth(d.getMonth()+1); setMonth(ym(d));
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold">BELVED HAIR • Booking</div>
          <div className="flex gap-2">
            <button onClick={()=>setPage("book")} className={`px-3 py-2 rounded ${page==='book'?'bg-black text-white':'border'}`}>Buchen</button>
            <button onClick={()=>setPage("admin")} className={`px-3 py-2 rounded ${page==='admin'?'bg-black text-white':'border'}`}>Admin</button>
          </div>
        </div>
      </nav>

      <div className="w-full max-w-xl mx-auto p-4 flex-1">
        {page==='book' && (
          <>
            <header className="py-6 text-center">
              <h1 className="text-2xl font-bold">Jetzt Termin vereinbaren!</h1>
              <p className="text-gray-500 mt-1">Bestätigung & Erinnerung über deinen Kalender.</p>
            </header>

            <div className="flex gap-3 mb-6 justify-center">
              {[1,2,3].map(n=>(
                <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${step>=n?'bg-green-600':'bg-gray-400'}`}>{n}</div>
              ))}
            </div>

            {step===1 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">Wähle deinen Friseur aus</h2>
                <div className="space-y-3">
                  {barbers.map(b=>(
                    <button key={b.id} onClick={()=>setBarberId(b.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded border ${barberId===b.id?'border-black':'border-gray-200'} bg-white`}>
                      <img src={b.photo_url||"https://placehold.co/64x64"} className="w-16 h-16 rounded-full object-cover"/>
                      <div className="text-left">{b.name}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button disabled={!barberId} onClick={()=>setStep(2)}
                    className={`px-5 py-3 rounded ${barberId?'bg-black text-white':'bg-gray-300 text-gray-600'}`}>WEITER</button>
                </div>
              </div>
            )}

            {step===2 && (
              <div className="space-y-4">
                {(noFreeInMonth || (date && slots.length===0)) && (
                  <div className="bg-yellow-200 text-yellow-900 rounded p-3">
                    <div className="font-medium">Kein Termin mehr frei?</div>
                    <button onClick={()=>setPrioOpen(v=>!v)}
                      className="mt-2 px-4 py-2 rounded bg-yellow-600 text-white">Priority-Anfrage senden</button>
                  </div>
                )}

                <h2 className="font-semibold text-lg">Wähle Datum & Uhrzeit</h2>

                <Calendar
                  month={month}
                  days={days}
                  selectedDate={date}
                  onPrev={prevMonth}
                  onNext={nextMonth}
                  onPick={(d)=> setDate(d)}
                />

                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Zeit</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(!date || slots.length===0) && <div className="col-span-3 text-gray-500">Bitte Tag wählen – oder kein Slot verfügbar.</div>}
                    {slots.map(s=>(
                      <button key={s} onClick={()=>setTime(s)}
                        className={`py-3 rounded ${time===s?'bg-black text-white':'bg-gray-100'}`}>{s}</button>
                    ))}
                  </div>
                </div>

                {prioOpen && (
                  <div className="bg-white border rounded p-4 space-y-3">
                    <div className="font-semibold">Priority-Anfrage</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="border p-2 rounded col-span-1" value={date} onChange={e=>setDate(e.target.value)} />
                      <input type="time" className="border p-2 rounded col-span-1" value={prioTime} onChange={e=>setPrioTime(e.target.value)} />
                    </div>
                    <input placeholder="Vollständiger Name" className="border p-2 rounded w-full" value={name} onChange={e=>setName(e.target.value)} />
                    <input placeholder="Telefonnummer (+43…)" className="border p-2 rounded w-full" value={phone} onChange={e=>setPhone(e.target.value)} />
                    <input placeholder="Notiz (optional)" className="border p-2 rounded w-full" value={prioNote} onChange={e=>setPrioNote(e.target.value)} />
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
                      <span>Ich stimme der <a className="underline" href="/datenschutz" target="_blank">Datenschutzerklärung</a> zu.</span>
                    </label>
                    <input className="hidden" autoComplete="off" value={hp} onChange={e=>setHp(e.target.value)} />
                    <div className="flex justify-end">
                      <button onClick={submitPriority} className="px-5 py-3 rounded bg-black text-white">Priority anfragen</button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button onClick={()=>setStep(1)} className="px-5 py-3 rounded bg-gray-200">ZURÜCK</button>
                  <button disabled={!canNext2} onClick={()=>setStep(3)}
                    className={`px-5 py-3 rounded ${canNext2?'bg-black text-white':'bg-gray-300 text-gray-600'}`}>WEITER</button>
                </div>
              </div>
            )}

            {step===3 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">Deine Daten</h2>
                <input placeholder="Vollständiger Name" className="w-full border rounded p-3 bg-white" value={name} onChange={e=>setName(e.target.value)} />
                <input placeholder="Telefonnummer (+43…)" className="w-full border rounded p-3 bg-white" value={phone} onChange={e=>setPhone(e.target.value)} />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
                  <span>Ich stimme der <a className="underline" href="/datenschutz" target="_blank">Datenschutzerklärung</a> zu.</span>
                </label>
                <input className="hidden" autoComplete="off" value={hp} onChange={e=>setHp(e.target.value)} />
                <div className="flex justify-between">
                  <button onClick={()=>setStep(2)} className="px-5 py-3 rounded bg-gray-200">ZURÜCK</button>
                  <button onClick={submit} disabled={!consent} className={`px-5 py-3 rounded ${consent?'bg-black text-white':'bg-gray-300 text-gray-600'}`}>BUCHUNG BESTÄTIGEN</button>
                </div>
              </div>
            )}

            {ok && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded p-4">
                <div className="font-semibold text-green-800">Buchung/Anfrage erfasst</div>
                <div className="text-sm text-green-800 mt-1">
                  {ok.barber ? <>Friseur: <b>{ok.barber}</b><br/></> : null}
                  Zeit: <b>{ok.dt}</b><br/>
                  {ok.id ? <>Buchungs-ID: <b>{ok.id}</b><br/></> : null}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    className="px-4 py-2 rounded border"
                    onClick={()=>downloadICS(ok.barber||"Belved Hair", ok.dt!.slice(0,10), ok.dt!.slice(11,16))}
                  >
                    .ics herunterladen
                  </button>
                  <a
                    className="px-4 py-2 rounded border"
                    href={gcalLink(ok.barber||"Belved Hair", ok.dt!.slice(0,10), ok.dt!.slice(11,16))}
                    target="_blank"
                  >
                    In Google Kalender
                  </a>
                </div>
                <button className="mt-3 px-4 py-2 rounded border" onClick={()=>setOk(null)}>Schließen</button>
              </div>
            )}
          </>
        )}

        {page==='admin' && (
          <Admin apiBase={API} barbers={barbers.map(b=>({id:b.id, name:b.name}))} />
        )}
      </div>

      <footer className="bg-white border-t">
        <div className="max-w-xl mx-auto px-4 py-4 text-sm text-center flex items-center justify-center gap-4">
          <a className="underline" href="/impressum">Impressum</a>
          <a className="underline" href="/datenschutz">Datenschutz</a>
        </div>
      </footer>
    </div>
  );
}
