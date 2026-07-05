# Setup & rulare

## 1. Variabile de mediu

Fisierul `.env` (deja prezent) contine:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## 2. Aplicarea migrarilor pe Supabase

Proiectul e deja legat (`supabase link`). Migrarile din `supabase/migrations/`
sunt versionate in Git si se aplica pe proiectul remote cu:

```bash
npx supabase db push
```

Ordinea migrarilor:

1. `..._init_schema.sql` - tabele, constrangeri, indexuri, updated_at
2. `..._rls_policies.sql` - functii helper + RLS + politici
3. `..._triggers.sql` - auto organizatie_id, legare auth.users, limite plan
4. `..._rpc_onboarding.sql` - onboarding, invitatii, profil curent
5. `..._views_dashboard.sql` - view-uri dashboard
6. `..._seed_plans.sql` - planurile SaaS (Free/Pro/Enterprise)

### Local (optional, necesita Docker)

```bash
npx supabase start      # ridica Postgres + Studio local
npx supabase db reset   # aplica migrari + seed.sql
```

## 3. Regenerarea tipurilor TypeScript (dupa push)

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

## 4. Rularea aplicatiei

```bash
npm install
npm run start      # apoi apasa i (iOS) / a (Android) / w (web)
```

## 5. Test rapid al fluxului

1. Deschide app -> **Creeaza cont** (email + parola).
2. Esti dus la **Onboarding** -> alegi "Profesor independent" sau "Firma",
   completezi datele -> se creeaza organizatia.
3. Ajungi pe **Panou** (dashboard). Ca admin poti **invita** profesori/elevi.

## Verificarea izolarii multi-tenant (critic)

Creeaza doua conturi diferite (organizatii diferite) si confirma ca datele
uneia nu apar in cealalta. La nivel SQL poti testa cu doi useri si
`select * from student;` - fiecare vede doar randurile organizatiei sale.
