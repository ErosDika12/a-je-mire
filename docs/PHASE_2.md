# Faza 2 — zgjerimi i produktit

Ky dokument përshkruan modulet e Fazës 2, si ndizen dhe fiken, çfarë mund të shohë kush, dhe çfarë mbetet
për t'u bërë nga njeriu. Rregullat e përhershme të projektit (pa diagnozë, pa pikë rreziku, pa kamerë,
pa kontakt automatik, pa renditje publike, pa shitje të dhënash, pa reklama, pa trajnim AI me të dhëna private)
vlejnë për çdo modul këtu dhe nuk kanë përjashtime.

## 1. Flamujt e veçorive

Dy shtresa, të dyja duhet të lejojnë:

| Shtresa | Ku | Çfarë kontrollon |
|---|---|---|
| Tavani i build-it | `js/flags.js` (`BUILD_CEILING`), sipas `VITE_APP_ENV` = `development` / `preview` / `production` | Nëse ndërfaqja e modulit ekziston fare në atë build |
| Flamujt e serverit | tabela `public.feature_flags` | `server_enabled` (çelësi global, **i zbatuar nga baza**), `pilot_only`, dhe `enabled_development/preview/production` (dukshmëria e UI-së sipas mjedisit) |

- Baza e zbaton `public.feature_enabled(key)` = `server_enabled AND (NOT pilot_only OR has_pilot_access())`
  në çdo RLS policy dhe RPC të modulit. Një modul i fikur refuzohet nga baza edhe nëse dikush e thërret API-në drejtpërdrejt.
- Preview dhe prodhimi ndajnë të njëjtin projekt Supabase. Prandaj një modul që duhet të jetë i paarritshëm në prodhim
  mbahet me `server_enabled = false`; për ta provuar në preview, administratori e ndez me `pilot_only = true`
  dhe u jep qasje pilot vetëm testuesve.
- Rikthimi i një moduli: fike flamurin (menjëherë, pa deploy). Për të hequr edhe skemën: `supabase/rollback/<migrimi>_down.sql`
  (shih `supabase/rollback/README.md`). Çdo modul ka migrimin e vet, prandaj rikthehet i pavarur.

### Gjendja në prodhim

| Moduli | Prodhim | Arsyeja |
|---|---|---|
| Sfidat (private) | **aktiv** | Jetojnë në pajisje; pa renditje, pa turp, arritjet mund të fshihen. Sfidat me miq kërkojnë lidhjet, që janë të fikura. |
| Administrimi | **aktiv** | I dukshëm vetëm për rolet në bazë; çdo veprim i ndjeshëm kërkon hyrje të freskët dhe auditohet. |
| Analitika | **aktive, vetëm me pëlqim** | Fikur për çdo përdorues derisa ta ndezë vetë te Privatësia; pa ID, validim në klient dhe në bazë. |
| Komuniteti, lidhjet, mesazhet | fikur | Përdoruesit janë kryesisht të mitur; kërkohet staf moderimi i caktuar, email transaksional (SMTP) dhe miratim i shkollës. Mesazhet nuk janë skaj-më-skaj. |
| Mentori | fikur | Ndan matje mirëqenieje me një llogari tjetër; kërkon politikë të miratuar për rolin e mentorit dhe pëlqimin e prindit/shkollës. |
| Njoftimet | fikur | Ruajtja e preferencave u verifikua; dorëzimi i vërtetë push në pajisje reale ende jo. |
| Asistenti AI | fikur | Nuk ka çelës ofruesi në Vault. Pa ofrues, moduli duhet të mbetet i fikur. |
| Abonimet | fikur | Nuk ka çelësa Stripe. Çmimi është vendmbajtës. |

## 2. Moderimi dhe politika e qasjes

- **Rolet**: `user`, `mentor`, `moderator`, `admin`, `owner` (plus `billing` vetëm për metadata abonimesh).
  Rolet lexohen vetëm nga tabela `user_roles`, kurrë nga metadata e klientit. Askush nuk ndryshon rolin e vet;
  vetëm pronari jep `admin`. Pronari caktohet nga `app_config.owner_email` + `claim_owner()`.
- **Moderatori** sheh vetëm përmbajtjen e raportuar, përmes `mod_open_report` — çdo hapje shkon në `audit_events`.
  Veprimet: hiq, fshih, rikthe, pezullo komunitetin ose mesazhet për 7 ditë. Çdo veprim auditohet.
- **Administratori** menaxhon flamujt, qasjen pilot, rolet, faqet e përmbajtjes; sheh analitikën anonime,
  auditimin dhe metadata e abonimeve. **Nuk ka asnjë rrugë për të lexuar check-ins, shënime, MY 5 apo kopjen e enkriptuar.**
- **Kërkesat ligjore**: pilotit nuk i shpikim identitet ligjor. Kontakti mbetet vendmbajtës i shënuar qartë derisa shkolla
  ose organizatori të caktojë një person përgjegjës. Të dhënat që serveri mund të dorëzojë janë vetëm ato që ruan:
  email, pëlqime, metadata, përmbajtje sociale; kopja e check-ins është e enkriptuar me fjalëkalim që serveri nuk e ka.
- **Mbajtja**: raportet e mbyllura humbin kopjen e përmbajtjes pas 180 ditësh; ndarjet e revokuara/skaduara fshihen çdo natë;
  njoftimet pas 90 ditësh; analitika pas 180 ditësh. Fshirja e llogarisë fshin gjithë përmbajtjen e përdoruesit (cascade);
  auditimi dhe raportet mbajnë vetëm referencë të zbrazët (`SET NULL`).
- **Kufijtë**: postime, përgjigje, reagime, kërkesa lidhjesh, mesazhe dhe raporte kanë kufij shpejtësie në bazë (`enforce_rate`);
  pseudonimet kontrollohen për fjalë të rezervuara dhe ngjashmëri (1/l/i).

## 3. Enkriptimi — deklarata e saktë

- **Kopja rezervë e check-ins**: enkriptim në anën e klientit (AES-GCM 256, PBKDF2-SHA256 me 600 000 përsëritje).
  Serveri nuk mund ta lexojë. Nuk e quajmë "end-to-end", sepse nuk ka komunikim mes personave.
- **Postimet, mesazhet, ndarjet me mentor**: ruhen në server, të mbrojtura me TLS dhe Row Level Security,
  **jo të enkriptuara skaj-më-skaj**. Kjo thuhet në ekranin e mesazheve dhe te Privatësia.

## 4. Asistenti AI

Vetëm kur e nis përdoruesi; parapamje e saktë e JSON-it që dërgohet; pa email, pa ID, pa emra; shënimet dhe MY 5 përjashtohen
si parazgjedhje; konfirmim para dërgimit; alternativë lokale pa AI. Çelësi i ofruesit rri vetëm në Vault dhe lexohet nga
Edge Function `ai-reflect` (Anthropic, `claude-haiku-4-5-20251001`, 500 tokenë). Kufiri: 5 kërkesa në ditë (30 me Plus).
Funksioni nuk regjistron përmbajtjen, nuk e ruan përgjigjen, dhe e kontrollon përgjigjen (`_shared/ai-guard.js`) për
etiketa gjendjesh, pikë rreziku dhe udhëzime kontakti automatik para se ta kthejë.

## 5. Abonimet

Stripe Checkout dhe Customer Portal të mbajtura jashtë; webhook me verifikim nënshkrimi dhe idempotencë (`webhook_events`);
7 ditë hir pas një pagese të dështuar; anulimi nuk fshin asnjë të dhënë; bërthama falas mbetet falas.

## 6. Veprimet që kërkojnë njeriun

1. **SMTP i personalizuar** në Supabase Auth, dhe Site URL / Redirect URLs = `https://a-je-mire.vercel.app`
   (SMTP-ja e integruar dërgon vetëm te anëtarët e ekipit, prandaj regjistrimi i të panjohurve nuk funksionon ende).
2. **Mbrojtja nga fjalëkalimet e rrjedhura** në Supabase Auth.
3. **Stripe**: `stripe_secret_key`, `stripe_webhook_secret`, `stripe_price_plus` në Vault, dhe webhook-u te
   `…/functions/v1/stripe-webhook`. Pastaj ndizet flamuri `subscriptions`.
4. **Anthropic**: `anthropic_api_key` në Vault. Pastaj ndizet flamuri `ai`.
5. **Pronari**: `app_config.owner_email` për `claim_owner()`.
6. **Vercel**: lidhja e repository-t me projektin për deploy automatik nga Git.
7. Miratimi i shkollës/organizatorit dhe personi i kontaktit para ndezjes së moduleve sociale.

## 7. Testet

| Komanda | Çfarë provon |
|---|---|
| `npm test` | 21 teste: enkriptimi, bashkimi, consent-i, rojet e AI, përkthimet (çelësa të njëjtë, çelësa të përdorur), filtri i analitikës, sfidat, mentori, anglishtja, asnjë emër gjendjeje |
| `supabase/tests/phase2_*.sql` | RLS me dy përdorues, përdorues i bllokuar, grant i skaduar, moderator, admin, anashkalim flamuri — në transaksion që kthehet mbrapsht |
| `tests/e2e/phase1.mjs` | 15 kontrolle: modaliteti lokal, hyrja, enkriptimi, rikthimi, konfliktet, offline |
| `tests/e2e/phase2.mjs` | 53 kontrolle me katër përdorues, përfshirë axe (WCAG 2 A/AA) dhe celularin |
| `tests/e2e/i18n-sweep.mjs` | Çdo ekran në anglisht: asnjë tekst shqip, asnjë gabim në konsolë |
| `tests/e2e/webhook.mjs` | Nënshkrimi, idempotenca dhe hiri i webhook-ut të Stripe |
| `tests/e2e/themes.mjs` | Temat pastel dhe të personalizuara, pa dëgjues të dyfishtë, a11y |
| `tests/e2e/production.mjs` | Prodhimi: modulet e fikura nuk arrihen as nga UI, as nga API (edhe me qasje pilot); rifreskim pa cache; konsola |
| `tests/e2e/delete-accounts.mjs` | Fshirja e llogarisë përmes ndërfaqes; të dhënat lokale mbeten |
