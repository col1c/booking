import { useMemo, useState } from "react";

type Barber = { id:string; name:string };
type Item = {
  id:string; customer_name:string; phone_e164:string; email?:string;
  status:string; start_local:string; end_local:string; barber_name:string; service_name:string;
};

type Props = {
  apiBase: string;
  barbers: Barber[];
};

export default function Admin({apiBase, barbers}: Props){
  const [user,setUser]=useState("admin");
  const [pass,setPass]=useState("");
  const [from,setFrom]=useState(()=>new Date().toISOString().slice(0,10));
  const [to,setTo]=useState(()=>{ const d=new Date(); d.setDate(d.getDate()+14); return d.toISOString().slice(0,10);});
  const [barberId,setBarberId]=useState<string>("");
  const [items,setItems]=useState<Item[]>([]);
  const auth = useMemo(()=> "Basic " + btoa(`${user}:${pass}`),[user,pass]);

  async function load(){
    const u = new URL(apiBase+"/admin/bookings");
    u.searchParams.set("frm",from); u.searchParams.set("to",to);
    if(barberId) u.searchParams.set("barber_id",barberId);
    const r = await fetch(u.toString(),{ headers:{ Authorization: auth }});
    if(!r.ok){ alert("Login fehlgeschlagen"); return; }
    const j = await r.json(); setItems(j.items||[]);
  }

  async function cancel(id:string){
    const u = new URL(apiBase+"/admin/cancel");
    u.searchParams.set("booking_id",id);
    const r = await fetch(u.toString(),{ method:"POST", headers:{ Authorization: auth }});
    if(r.ok){ setItems(prev=>prev.map(x=> x.id===id ? {...x, status:"cancelled"}:x)); }
  }

  const [tfBarber,setTfBarber]=useState<string>("");
  const [tfDate,setTfDate]=useState<string>(new Date().toISOString().slice(0,10));
  const [tfStart,setTfStart]=useState<string>("10:00");
  const [tfEnd,setTfEnd]=useState<string>("12:00");
  const [tfReason,setTfReason]=useState<string>("Block");

  async function addTimeOff(){
    const payload = {
      barber_id: tfBarber || barberId || (barbers[0]?.id ?? ""),
      start_local_iso: `${tfDate}T${tfStart}`,
      end_local_iso: `${tfDate}T${tfEnd}`,
      reason: tfReason
    };
    const r = await fetch(apiBase+"/admin/time_off",{
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization: auth },
      body: JSON.stringify(payload)
    });
    if(r.ok){ alert("Pausenblock eingetragen."); load(); }
    else alert("Fehler beim Eintragen.");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Admin</h2>

      <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded border">
        <input placeholder="Benutzer" className="border p-2 rounded" value={user} onChange={e=>setUser(e.target.value)} />
        <input placeholder="Passwort" type="password" className="border p-2 rounded" value={pass} onChange={e=>setPass(e.target.value)} />
        <div className="col-span-2 flex gap-3">
          <select className="border p-2 rounded" value={barberId} onChange={e=>setBarberId(e.target.value)}>
            <option value="">Alle Friseure</option>
            {barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="date" className="border p-2 rounded" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" className="border p-2 rounded" value={to} onChange={e=>setTo(e.target.value)} />
          <button onClick={load} className="px-4 py-2 rounded bg-black text-white">Laden</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded border overflow-x-auto">
        <div className="font-semibold mb-3">Buchungen</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Zeit</th>
              <th>Friseur</th>
              <th>Kunde</th>
              <th>Kontakt</th>
              <th>Service</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id} className="border-b">
                <td className="py-2">{it.start_local} – {it.end_local}</td>
                <td>{it.barber_name}</td>
                <td>{it.customer_name}</td>
                <td>{it.phone_e164}{it.email?` • ${it.email}`:""}</td>
                <td>{it.service_name}</td>
                <td className={it.status==='cancelled'?'text-red-600':''}>{it.status}</td>
                <td>{it.status!=='cancelled' && <button onClick={()=>cancel(it.id)} className="px-3 py-1 border rounded">Stornieren</button>}</td>
              </tr>
            ))}
            {items.length===0 && <tr><td className="py-3 text-gray-500">Keine Einträge</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 rounded border">
        <div className="font-semibold mb-3">Pausen / Urlaub eintragen</div>
        <div className="grid grid-cols-2 gap-3">
          <select className="border p-2 rounded" value={tfBarber} onChange={e=>setTfBarber(e.target.value)}>
            <option value="">(oben gewählten nutzen)</option>
            {barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="date" className="border p-2 rounded" value={tfDate} onChange={e=>setTfDate(e.target.value)} />
          <input type="time" className="border p-2 rounded" value={tfStart} onChange={e=>setTfStart(e.target.value)} />
          <input type="time" className="border p-2 rounded" value={tfEnd} onChange={e=>setTfEnd(e.target.value)} />
          <input placeholder="Grund (optional)" className="border p-2 rounded col-span-2" value={tfReason} onChange={e=>setTfReason(e.target.value)} />
          <div className="col-span-2">
            <button onClick={addTimeOff} className="px-4 py-2 rounded bg-black text-white">Block setzen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
