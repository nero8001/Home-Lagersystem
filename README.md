# Lagerprogramm für Zuhause

Private, mehrbenutzerfähige Lagerverwaltung als responsive Web-App. Aktueller Entwicklungsstand: **v0.3.0**.

## v0.3.0
- Barcode-Scanner über die Gerätekamera direkt im Artikel-Formular ergänzt.
- Erkannte EAN-/UPC-/Code-128-/Code-39-/QR-Codes werden automatisch ins Barcode-Feld übernommen und wie gewohnt mit dem Artikel gespeichert.
- Manuelle Barcode-Eingabe bleibt verfügbar; verständliche Hinweise bei fehlender Browserunterstützung oder verweigertem Kamerazugriff.

## v0.2.6
- Mindestbestand-Feld kann beim Bearbeiten leer sein; ein leerer Wert wird erst beim Speichern zu 0.
- E-Mail- und Passwortfelder sind im Login-/Registrierungsbereich dauerhaft sichtbar hinterlegt, auch auf Mobilgeräten.

## v0.2.5
- Mobiles Seitenmenü ist scrollbar, damit auch der Abmelden-Eintrag erreichbar bleibt.
- Mengen- und Mindestbestandsfelder lassen sich vollständig leeren; beim Speichern wird ein leerer Wert zu 0.
- Registrierung prüft die Passwortanforderungen; E-Mail kann optional nur beim Login gespeichert werden, Passwörter bleiben ungespeichert.

## Lokal starten

```bash
npm install
npm run dev
```

## Supabase einrichten

**Wichtig:** Verwende ein neues, ausschließlich für dieses Lagerprogramm angelegtes Supabase-Projekt. Das SQL-Schema ist für eine frische Datenbank gedacht und nicht als Upgrade des alten Demo-Schemas.

1. Erstelle ein Supabase-Projekt.
2. Öffne den SQL Editor und führe `supabase/schema.sql` vollständig aus.
3. Öffne Authentication → URL Configuration.
4. Setze Site URL auf `https://home-lagersystem.pages.dev` (später auf die eigene Lagerprogramm-Domain ändern).
5. Füge unter Redirect URLs auch `https://home-lagersystem.pages.dev/**` hinzu.
6. Öffne Project Settings → API und kopiere Project URL sowie den öffentlichen Publishable Key (oder legacy anon key).
7. Trage beide Werte in Cloudflare unter Workers & Pages → home-lagersystem → Settings → Environment variables ein:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = öffentlicher Publishable-/anon-Key
8. Hinterlege die Variablen mindestens für Production und löse anschließend ein neues Deployment aus.

**Niemals** den `service_role`-Key oder einen Secret Key in die Web-App oder in GitHub eintragen. RLS ist aktiv und muss aktiviert bleiben.

### E-Mail-Bestätigung

Die Registrierung kann eine E-Mail-Bestätigung verlangen. Für den Produktivbetrieb sollte in Supabase ein passender SMTP-Anbieter eingerichtet werden. Ohne eigene SMTP-Konfiguration können die standardmäßigen Auth-E-Mail-Limits greifen.

## Datenmodell

- `households`: eigenständige Haushalte
- `household_members`: Benutzerzuordnung und Rolle (`owner`, `admin`, `member`)
- `categories`: verschachtelte Kategorien je Haushalt
- `inventory_items`: Artikel je Haushalt

Ein Benutzer kann in mehreren Haushalten Mitglied sein. Die aktuelle Oberfläche erstellt beim ersten Login einen Haushalt. Einladungsverwaltung und Haushaltswechsel folgen in einem späteren Schritt.

## Cloudflare Pages

- Framework: React (Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

Cloudflare baut automatisch nach jedem Commit auf dem Production-Branch.

## Nächste Schritte

1. Produktsuche anhand erkannter Barcodes (Datenquelle und Trefferqualität prüfen)
2. Einkaufsliste
3. Haushalts-Einladungen und Rollenverwaltung
4. PWA sowie Android-/Windows-Pakete
