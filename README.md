# Lagerprogramm für Zuhause

Version **0.5.0**

Eine private, cloud-synchronisierte Lagerverwaltung für Zuhause mit React, TypeScript, Vite und Supabase.

## v0.4.1 – Produktsuche und Produktbilder
- Gemeinsame Produktsuche über Open Food Facts, Open Beauty Facts und Open Products Facts (Barcode- und Textsuche).
- Kuratierte Produktvorlagen für BioTechUSA-Proteinpulver und Bambu-Lab-Filamente.
- Produktbilder können über den dauerhaft gespeicherten Schalter „Produktbilder“ global ein- und ausgeblendet werden.
- Treffer können direkt in das Artikelformular übernommen und anschließend wie gewohnt in Supabase gespeichert werden.

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


### v0.5.0
- Haushaltsweiter Produktkatalog: manuell erfasste Artikel mit Barcode werden für alle Mitglieder des Haushalts wiederverwendbar.
- Produktsuche prüft zuerst den eigenen Haushaltskatalog und ergänzt anschließend externe Produktdatenbanken.
