# Lagerprogramm für Zuhause

Eine responsive Lagerverwaltung für den privaten Haushalt. Dieses Repository enthält den Web-App-Grundstand (v0.1.1).

## Funktionen im aktuellen Grundstand

- Dashboard mit Bestandsübersicht und Warnungen
- Artikel hinzufügen, bearbeiten und löschen
- Mengen über `+`, `−` oder direkte Eingabe ändern
- Beliebig tief verschachtelte Kategorien und Unterkategorien
- Kategorien umbenennen und löschen (Löschen nur ohne zugeordnete Artikel/Unterkategorien)
- Suche und Kategorie-Filter
- Mindestbestand und Lagerort
- Deutsch/Englisch-Umschaltung
- Lokaler Demomodus mit Speicherung im Browser
- Vorbereiteter Supabase-Client und SQL-Grundschema

## Lokal starten

Voraussetzung: Node.js (empfohlen: aktuelle LTS-Version).

```bash
npm install
npm run dev
```

Die im Terminal angezeigte lokale Adresse im Browser öffnen.

## Supabase verbinden

1. Ein neues Supabase-Projekt für dieses Lagerprogramm anlegen (getrennt vom Pokémon Champions Companion).
2. `supabase/schema.sql` im SQL Editor des neuen Projekts ausführen.
3. `.env.example` in `.env.local` umbenennen.
4. `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` aus den Supabase-Projekteinstellungen eintragen.
5. Entwicklungsserver neu starten.

Bis die Supabase-Variablen gesetzt sind, verwendet die App den lokalen Demomodus. Im aktuellen Stand werden die Lagerdaten lokal gespeichert. Die Supabase-Tabellen und Sicherheitsrichtlinien sind vorbereitet; die echte Anmeldung und Cloud-Synchronisierung folgen als nächster Entwicklungsschritt.

**Wichtig:** Niemals den `service_role`-Schlüssel in eine Web-App oder in GitHub eintragen. Nur den öffentlichen `anon`/publishable Key verwenden. RLS bleibt aktiviert.

## GitHub / Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Framework preset: Vite
- Environment variables: dieselben beiden `VITE_SUPABASE_*` Variablen wie oben

## Geplante nächste Schritte

1. Supabase Auth mit Registrierung, Anmeldung und Passwort-zurücksetzen
2. Datenzugriff und Synchronisierung mit Row Level Security
3. Barcode-Scanner und Produktdatenquellen
4. Einkaufsliste und PWA-Installation
5. Android- und Windows-Pakete

## Technologie

React, TypeScript, Vite, Lucide React und Supabase.

## Änderungen in v0.1.1

- Lagerort-Anzeige in der Artikeltabelle korrigiert.
- Kategorien werden jetzt über mehrere Verschachtelungsebenen dargestellt.
- Kategorien können umbenannt und – sofern leer – gelöscht werden.
