# Belved Hair – Komplettes Projekt (Free-Mode)

Zwei Ordner:
- `backend/` – FastAPI (ohne SMS/Cron), Admin per HTTP Basic
- `frontend/` – Vite + React + Tailwind (Kalender-Export statt SMS)

## 1) Datenbank vorbereiten (Supabase oder lokales Postgres)
- Öffne `backend/schema.sql` und führe den Inhalt aus.

## 2) Backend lokal starten
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Einträge setzen
uvicorn main:app --reload --port 8000
```

## 3) Frontend lokal starten
```bash
cd ../frontend
npm install
npm run dev
```
- Browser: http://localhost:5173

## Login Admin
- In der Top-Navigation „Admin“ → Login mit `ADMIN_USER/ADMIN_PASS` aus Backend `.env`.

## Hinweis
- Alle Zeiten werden in der Shop-Zeitzone (`SHOP_TZ`) berechnet; Speicherung UTC.
- Slots/Längen: 30 Minuten fix.
