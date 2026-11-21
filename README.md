# Lagerprogramm für Zuhause

Version **0.6.1**

Eine private, cloud-synchronisierte Lagerverwaltung für Zuhause mit React, TypeScript, Vite und Supabase.

## Letzte größere Änderungen

### v0.6.1 – Haushaltswechsel und Oberfläche
- Alle Haushalte eines Kontos werden geladen; der aktive Haushalt kann über die Seitenleiste gewechselt werden.
- Nach Annahme einer Einladung wird der eingeladene Haushalt automatisch ausgewählt und die Auswahl bleibt gespeichert.
- Desktop-Seitenleiste bleibt beim Scrollen fixiert; E-Mail-Speicheroption im Login kompakter gestaltet.

### v0.6.0 – Haushaltseinladungen
- Einladungen per E-Mail und Einladungscode mit sieben Tagen Gültigkeit.
- Supabase-RPCs für das Erstellen und Annehmen von Einladungen sowie vorbereitete Edge Function für Resend.

### v0.5.0 – Eigener Haushalts-Produktkatalog
- Barcode-Produktzuordnungen werden haushaltsbezogen in Supabase gespeichert und bei späteren Suchen bevorzugt.

## Entwicklung

```bash
npm install
npm run dev
```

Build für Cloudflare Pages:

```bash
npm run build
```

Build-Ausgabe: `dist`

## Konfiguration

Lege in der Deployment-Umgebung diese Variablen an:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (öffentlicher Publishable-/Anon-Key, niemals ein Service-Role- oder Secret-Key)

Das Supabase-Schema befindet sich unter `supabase/schema.sql`.

## Datenquellen und Hinweise

- Open Food Facts: https://world.openfoodfacts.org/
- Open Beauty Facts: https://world.openbeautyfacts.org/
- Open Products Facts: https://world.openproductsfacts.org/
- BioTechUSA und Bambu Lab: lokale Produktvorlagen zur Ergänzung durch manuelle Angaben.

Open Products Facts ist experimentell und kann eine geringere Datenabdeckung haben. Die externen Produktdaten werden zur Suche live abgefragt; die Auswahl wird erst beim Speichern als eigener Lagerartikel in Supabase abgelegt. Die ODbL-/Attributionsbedingungen der Open-Facts-Datenbanken und die jeweiligen Bildlizenzen sind vor öffentlicher Weitergabe oder Aufbau eines abgeleiteten Gesamtkatalogs zu beachten. USDA FoodData Central ist in dieser Version noch nicht integriert, da dafür eine serverseitig zu verwaltende API-Konfiguration sinnvoll ist.


## v0.4.1
- Barcode direkt im Produktsuchfeld per Kamera scannen.
- Gescannte Nummer wird als Suchbegriff und Artikel-Barcode übernommen.
- Nicht gelistete Produkte lassen sich manuell benennen und mit einem Barcode speichern.


### v0.6.0
- Haushaltsweiter Produktkatalog: manuell erfasste Artikel mit Barcode werden für alle Mitglieder des Haushalts wiederverwendbar.
- Produktsuche prüft zuerst den eigenen Haushaltskatalog und ergänzt anschließend externe Produktdatenbanken.


## v0.6.0 – Haushalts-Einladungen
- Mitgliederverwaltung mit Einladungen per E-Mail und teilbarem Einladungscode.
- Einladungen sind 7 Tage gültig, einmalig verwendbar und optional an eine E-Mail-Adresse gebunden.
- Supabase Edge Function für den E-Mail-Versand (Resend) ergänzt.

### Einrichtung der Einladungen
1. `supabase/household_invites.sql` einmal im Supabase SQL Editor ausführen.
2. Die Edge Function `supabase/functions/send-household-invite/index.ts` als `send-household-invite` deployen.
3. In den Edge-Function-Secrets `RESEND_API_KEY` und `INVITE_FROM_EMAIL` hinterlegen. Die Absenderadresse muss bei Resend verifiziert sein.
4. Ohne eingerichteten E-Mail-Versand kann weiterhin ein Einladungscode erzeugt und der Einladungslink geteilt werden.
5. Einladungscodes laufen nach 7 Tagen ab und können nur einmal eingelöst werden.
