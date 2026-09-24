# Rikthimi i migrimeve (rollback)

Çdo modul i Fazës 2 ka skriptin e vet `*_down.sql`. Ekzekutohen **në rend të kundërt** (më i riu së pari),
vetëm pasi moduli është fikur dhe është bërë kopje e bazës.

Rikthimi pa fshirë të dhëna (i rekomanduar): fik modulin te flamujt.

```sql
update public.feature_flags set server_enabled = false, enabled_production = false where key = '<moduli>';
```

Politikat RLS e mbyllin menjëherë çdo qasje nga API, edhe nëse dikush e anashkalon ndërfaqen.

Skriptet `_down` FSHIJNË tabelat e modulit dhe të dhënat e tyre. Nuk prekin tabelat e Fazës 1
(`profiles`, `encrypted_backups`, `consent_records` përveç llojeve të reja të pëlqimit).
