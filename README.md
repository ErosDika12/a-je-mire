# A JE MIRË? 2036

**Human Connection & Wellbeing Intelligence**
KosICT 15 — Future Developers Corner — Kosova 2036

Sistem opt-in që mëson se si duket një javë e zakonshme për ty, vëren kur patterni yt ndryshon,
dhe të ndihmon të arrish një person që e ke zgjedhur vetë.

Momenti qendror i produktit:

> Sistemi nuk thotë "ti ke X".
> Sistemi thotë "diçka ndryshoi krahasuar me patternin tënd normal" — dhe tregon faktorët e matshëm që lëvizën.

---

## Çfarë bën

| Moduli | Çfarë tregon |
|---|---|
| **Consent** | Çfarë mblidhet, pse, ku ruhet. Dy toggle të ndarë. Asgjë nuk shkruhet para pranimit. |
| **Kryefaqja** | Statusi i sotëm, progresi i baseline-it, trendi 7-ditor, ndryshimi kryesor, hapi i radhës. |
| **Check-in** | Gjashtë rrëshqitës, tags aktivitetesh, shënim opsional. Një check-in për ditë. |
| **My Normal** | Mesatarja jote nga 23 ditët bazë, me sparkline, linjë kohore dhe numrin e ditëve pas çdo numri. |
| **Something Changed** | Cilat matje lëvizën, sa, dhe krahasimi vizual normale kundrejt tani. |
| **Why?** | Korrelacione, lidhje me vonesë një ditë, mesatare me kusht, fjalët kryesore të shënimeve. |
| **What Helps Me?** | Aktivitetet e renditura sipas provës në të dhënat e tua, plus reflektimi javor. |
| **Lidhjet** | MY 5, KAFE? dhe Connection Wall nën një tab. Pa import kontaktesh, pa renditje sipas rëndësisë. |
| **Të dhënat e mia** | Përmbledhje, historiku i pëlqimeve, eksport, import (zëvendëso ose bashko), kopje lokale para zëvendësimit. |
| **Llogaria** *(opsionale)* | Email + verifikim, hyrje/dalje, rivendosje fjalëkalimi, dalje nga të gjitha pajisjet, Qendra e sinkronizimit, tri fshirje të ndara. |
| **Privatësia** | Privatësia, Kushtet, Ndihma, ndryshimet dhe "Raporto një problem". |
| **Prezantim i udhëhequr** | Tetë ndalesa, dy deri tre minuta, me back, next dhe progres. |

---

## Çfarë NUK bën — kurrë

- **Nuk vendos diagnozë.** Asnjë emër gjendjeje mjekësore nuk shfaqet askund: as në UI, as në kod, as në këtë README.
- **Nuk përdor kamerë** dhe nuk lexon fytyra apo emocione. Nuk ka asnjë input vizual.
- **Nuk dërgon asgjë automatikisht.** Maksimumi që bën është të përgatisë një draft dhe ta kopjojë në clipboard. Dërgimin e bën njeriu.
- **Nuk shkruan asgjë pa consent.** `saveProfile()` te `js/storage.js` del pa bërë asgjë nëse `consent.store !== true`. Kjo është e vetmja rrugë shkrimi.
- **Nuk përdor të dhëna reale.** Profili demo gjenerohet nga `js/seed.js` me farë fikse. Kjo shkruhet e dukshme në ekran.
- **Pa llogari, nuk i çon të dhënat askund.** Asnjë kërkesë rrjeti. Pa analytics, pa reklama, pa font të jashtëm.
- **Me llogari, serveri sheh vetëm tekst të enkriptuar.** Shih "Pilot publik" më poshtë.
- **Nuk të krahason me persona të tjerë** dhe nuk pretendon se korrelacioni provon shkakun.

---

## Teknologjia

HTML + CSS + JavaScript me ES modules, pa framework. Vite përdoret vetëm për bashkimin e moduleve dhe variablat e mjedisit;
e vetmja varësi runtime është `@supabase/supabase-js`, dhe ngarkohet vetëm kur përdoruesi hap Llogarinë.
Grafikat janë SVG i shkruar me dorë. CSS-ja është e shkruar me dorë, me variabla.

```
a-je-mire/
├── index.html            guaska e aplikacionit, të gjitha ekranet
├── 404.html              faqja e gabimit
├── favicon.svg
├── og.png                pamja e parë për rrjetet sociale
├── css/style.css         tokenat e dizajnit, tema e çelët dhe e errët
├── js/
│   ├── app.js            router, guaska, navigimi
│   ├── storage.js        lexo · ruaj · eksporto · importo · migro · fshij
│   ├── seed.js           profili sintetik 30-ditor dhe profili privat bosh
│   ├── stats.js          mean, std, movingAvg, pctChange, zScore, corr, normalize, trendDirection
│   ├── patterns.js       myNormal, somethingChanged, correlations, whatHelpsMe, ...
│   ├── nlp.js            tokenize, stopwords, fjalët kryesore nga shënimet
│   ├── compose.js        reflektimi javor, draftet e mesazheve, sugjerimi i lidhjes
│   ├── chart.js          scale, drawLine dhe grafikat SVG
│   ├── ui.js             ikona, toast, temë, tooltip, modale
│   ├── tour.js           prezantimi i udhëhequr
│   └── screens/          njëmbëdhjetë ekrane, një fajll për secilin
└── README.md
```

`stats.js` dhe `patterns.js` janë funksione të pastra: numra brenda, numra jashtë, asnjë prekje e DOM-it.

---

## Modeli i të dhënave

Gjithçka rri nën një çelës të vetëm në `localStorage`: **`ajemire.v1`**.

```json
{
  "version": 2,
  "mode": "demo",
  "consent": { "store": true, "ai": false, "acceptedAt": "2026-09-16T10:00:00Z" },
  "settings": { "baselineDays": 23, "recentDays": 7, "theme": "auto" },
  "checkins": [
    { "date": "2026-08-18", "mood": 8, "sleep": 7.5, "energy": 7, "social": 6,
      "joy": 7, "load": 4, "activities": ["basketboll", "shoket"], "note": "tekst i lirë" }
  ],
  "my5": [
    { "name": "Arta", "relation": "kushërirë", "color": "#6f63d8",
      "lastReached": "2026-09-02", "sharedActivity": "kafe" }
  ],
  "connections": [{ "date": "2026-09-02", "personName": "Arta", "activityKey": "kafe" }],
  "dismissed": [{ "date": "2026-09-16", "key": "Arta|kafe" }],
  "experiment": null
}
```

Profilet e versionit 1 migrohen automatikisht: fushat e reja shtohen, asnjë check-in nuk humbet.

`load` është e vetmja metrikë e përmbysur — më shumë ngarkesë do të thotë më keq. Drejtimi ruhet
në një konstante të vetme dhe përdoret kudo:

```js
const WORSE = { mood: -1, sleep: -1, energy: -1, social: -1, joy: -1, load: +1 };
```

---

## Llogaritjet

**My Normal** — mesatarja e secilës metrikë gjatë ditëve bazë. Periudha e fundit janë 7 ditët e fundit;
baseline-i janë deri në 23 ditët para saj. Për profilin 30-ditor kjo jep saktësisht ditët 1–23 dhe 24–30.

**Something Changed**

```
recent = mesatarja e 7 ditëve të fundit
base   = mesatarja e 23 ditëve bazë
pct    = (recent - base) / base * 100
z      = (recent - base) / devijimi standard i base-it
```

Një metrikë shënohet **nëse** lëvizi në drejtimin e keq për atë metrikë (sipas `WORSE`)
**dhe** `|pct| >= 15` ose `|z| >= 1.5`.
Sinjali shfaqet vetëm kur janë shënuar **dy ose më shumë** metrika — një faktor i vetëm është zhurmë.

**Why?** — korrelacion Pearson mes çdo çifti metrikash, korrelacion me vonesë (dita N kundrejt ditës N+1),
dhe mesatare me kusht: "në ditët ku gjumi dhe lidhja ishin mbi normalen tënde, humori mesatar ishte X kundrejt Y".

**What Helps Me?** — për çdo tag, mesatarja e metrikës në ditët me atë tag minus mesatarja në ditët pa të.
Minimumi 3 ditë me dhe 3 ditë pa, para se të shfaqet. Numri i ditëve tregohet gjithmonë pranë rezultatit.

**Trajtimi i të dhënave që mungojnë** — një ditë pa vlerë nuk bëhet kurrë zero; thjesht nuk numërohet.
Pjesëtimi me zero kthen `null`, jo `Infinity`. Çdo modul ka një prag minimal ditësh dhe nën atë prag
tregon gjendje të ndershme "ende nuk mjaftojnë ditët" në vend që të shpikë një përfundim.

---

## Si ta xhirosh

Hape `index.html` me Live Server (ose çfarëdo serveri statik). ES modules nuk punojnë me `file://`.

```bash
python -m http.server 8123
```

Funksionet e llogaritjes mund të provohen nga Console:

```js
AJM.stats.mean([2, 4, 6])                 // 4
AJM.stats.std([2, 4, 6])                  // 1.6329931618554523
AJM.stats.movingAvg([1, 2, 3, 4], 3)      // [null, null, 2, 3]
AJM.stats.corr([1, 2, 3], [2, 4, 6])      // 1
AJM.patterns.somethingChanged(AJM.app.profile.checkins, AJM.app.profile.settings)
```

## Deploy

Static site në Vercel, pa build command. Çdo fajll shërbehet ashtu siç është.


---

## Pilot publik (v2.0)

### Arkitektura
- **Local-first.** Pajisja është burimi kryesor. Pa llogari, aplikacioni nuk kontakton asnjë server.
- **Supabase Auth + Postgres** (projekt `a-je-mire`, BE/Frankfurt). Vetëm email + fjalëkalim, pa hyrje sociale.
  Fjalëkalimet i menaxhon Supabase Auth — aplikacioni nuk i ruan kurrë vetë.
- **Kopje e enkriptuar në pajisje** (`js/cloud/crypto.js`): AES-GCM 256, çelës nga PBKDF2-SHA256 me 600 000 përsëritje,
  kripë 16 bajt dhe IV 12 bajt të rastësishme në çdo ruajtje. Fjalëkalimi i sinkronizimit është i ndarë nga ai i llogarisë,
  mbahet vetëm në memorien e faqes dhe nuk dërgohet kurrë. E quajmë "enkriptim në anën e klientit", jo "end-to-end".
- **Sinkronizimi** (`js/cloud/sync.js`, `js/merge.js`): asgjë automatike. Funksioni `save_backup` në Postgres kontrollon revizionin
  në mënyrë atomike; nëse një pajisje tjetër ka ruajtur ndërkohë, kthen konflikt në vend që të mbishkruajë. Konfliktet e së njëjtës datë
  shfaqen krah për krah dhe i zgjidh përdoruesi.
- **Fshirja e llogarisë** bëhet nga Edge Function `delete-account` — çelësi service-role jeton vetëm aty, kurrë në shfletues.

### Baza e të dhënave
`supabase/migrations/` — tabelat `profiles`, `encrypted_backups` (një rresht për përdorues), `consent_records`, me RLS aktiv:
çdo përdorues lexon dhe shkruan vetëm rreshtat e vet.
`supabase/tests/rls_isolation.sql` — testi i automatizuar i izolimit: përdoruesi B nuk sheh, nuk ndryshon, nuk fshin
dhe nuk krijon asgjë për A-në; revizioni i vjetër jep konflikt. Ekzekutohet në transaksion që kthehet mbrapsht.

### PWA dhe siguria
- `pwa/sw.js` ruan vetëm guaskën (HTML/CSS/JS/ikona) të së njëjtës origjinë. Kërkesat te Supabase, çdo kërkesë me `Authorization`,
  dhe të dhënat e dekriptuara nuk kalojnë kurrë nga cache. Versioni i ri shfaq njoftim "Rifresko".
- `vercel.json`: CSP e rreptë (`script-src 'self'`, `connect-src` vetëm drejt projektit Supabase, `frame-ancestors 'none'`),
  `Referrer-Policy: no-referrer`, `Permissions-Policy` që ndalon kamerën, mikrofonin dhe vendndodhjen, HSTS, nosniff.

### Nisja lokale
```
npm ci
cp .env.example .env.local   # plotëso dy vlerat publike
npm run dev                  # http://localhost:5173
npm test                     # teste për enkriptimin, bashkimin dhe consent-in
npm run build && npm run preview
npm audit
```
