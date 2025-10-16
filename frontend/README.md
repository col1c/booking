# Belved Hair Booking – Frontend (Vite + React + Tailwind)

## Setup
```bash
npm install
cp .env .env.local  # optional, VITE_API_URL anpassen
npm run dev
```

Standard: API erwartet `http://localhost:8000` (siehe `.env`).

## Pages
- `/` – Buchungsflow inkl. Monatskalender, Timeslots, Priority-Anfrage, Kalender-Export (.ics / Google)
- `/impressum`, `/datenschutz`
- Admin in der App-Navigation (HTTP Basic im Backend).

## Build
```bash
npm run build && npm run preview
```
