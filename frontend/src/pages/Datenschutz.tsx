export default function Datenschutz(){
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Datenschutzerklärung (Kurzfassung)</h1>
      <ul className="list-disc pl-6 space-y-2">
        <li>Verarbeitung von Namen, Telefonnummer zur Terminvergabe.</li>
        <li>Zweck: Terminverwaltung, Erinnerungen via persönlichem Kalender (ICS/Google).</li>
        <li>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und lit. a (Einwilligung).</li>
        <li>Speicherdauer: bis Abschluss des Termins + gesetzliche Aufbewahrungspflichten.</li>
        <li>Auftragsverarbeiter: Hosting (Vercel/Render), Datenbank (Supabase).</li>
        <li>Betroffenenrechte: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit.</li>
        <li>Kontakt für Datenschutzanfragen: privacy@belvedhairs.at</li>
      </ul>
      <p className="text-sm text-gray-500 mt-6">Hinweis: Kein Rechtsrat – Inhalte an euer Unternehmen anpassen.</p>
    </div>
  );
}
