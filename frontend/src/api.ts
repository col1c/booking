const API = import.meta.env.VITE_API_URL as string;

export const getBarbers = () => fetch(`${API}/barbers`).then(r=>r.json());

export function getMonthOverview(barber_id: string, month: string){
  const u = new URL(`${API}/month_overview`);
  u.searchParams.set("barber_id", barber_id);
  u.searchParams.set("month", month);
  return fetch(u).then(r=>r.json());
}

export function getAvailability(barber_id: string, d: string){
  const u = new URL(`${API}/availability`);
  u.searchParams.set("barber_id", barber_id);
  u.searchParams.set("d", d);
  return fetch(u).then(r=>r.json());
}

export function book(payload: { barber_id: string; start_ts_iso: string; customer_name: string; phone_e164: string; }){
  return fetch(`${API}/book`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  }).then(async r=> r.ok ? r.json() : Promise.reject(await r.json()));
}

export function priorityRequest(payload: { barber_id: string; desired_local_iso: string; customer_name: string; phone_e164: string; notes?: string; }){
  return fetch(`${API}/priority_request`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  }).then(async r=> r.ok ? r.json() : Promise.reject(await r.json()));
}
