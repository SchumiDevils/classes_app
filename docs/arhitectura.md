# Arhitectura aplicatiei (MVP - Fazele 1-3)

Aplicatie **multi-tenant SaaS** pentru gestionarea lectiilor private: elevi,
grupe, contracte, orar, lectii, prezenta si plati - fiecare organizatie
(firma sau profesor independent) vede **doar** datele proprii.

## Stack

- **Mobil**: React Native (Expo SDK 57, Expo Router) - la radacina repo-ului.
- **Backend / DB**: Supabase (Postgres 17 + Auth + RLS). Cod in `supabase/`.
- **Docs**: `docs/`.

> Nota structura: planul initial propunea `/mobile`, `/supabase`, `/docs`.
> Aplicatia Expo era deja initializata la radacina, asa ca am pastrat-o acolo
> si am adaugat `supabase/` si `docs/` alaturi (evitam sa spargem config-ul Expo).

## Model de date (15 entitati)

Nivel SaaS (facturarea platformei):
`plan`, `organizatie`, `abonament`, `factura_saas`.

Conturi & profiluri: `utilizator` (legat de `auth.users`), `profesor`, `tutor`,
`student`.

Business: `tip_contract`, `grupa`, `contract`, `orar`, `lectie`, `prezenta`,
`plata`.

Fiecare tabela de business are `organizatie_id` (FK -> `organizatie`), pilonul
izolarii per tenant.

### Reguli de business codificate in DB

- `contract.pret_sesiune` = coloana **generata**:
  `round(pret_standard * (1 - reducere_aplicata), 2)`.
- Reducerile (`reducere_aplicata`, `reducere_loialitate`, `reducere_referral`)
  sunt **fractii zecimale** (`0.10` = 10%).
- Dashboard (view-uri):
  - `ore_realizate` = prezente (`prezent=true`) la lectii `REALIZATA`
  - `ore_achitate` = suma sesiunilor din `plata`
  - `balanta` = `ore_achitate - ore_realizate`
  - `venit` = suma sumelor incasate

## Multi-tenant & securitate (RLS)

- RLS este **activat pe toate tabelele**.
- Functii helper (`SECURITY DEFINER`, in schema privata `app`):
  - `app.current_org_id()` - organizatia utilizatorului curent
  - `app.current_rol()`, `app.is_admin()`, `app.is_staff()`
- Politica de baza (SELECT): `organizatie_id = app.current_org_id()`.
- Trigger `set_tenant_id` completeaza automat `organizatie_id` la INSERT, deci
  clientul nu trimite niciodata manual acest camp.

### Matrice de permisiuni (MVP)

| Tabela                          | SELECT        | INSERT/UPDATE/DELETE      |
|---------------------------------|---------------|---------------------------|
| organizatie                     | membrii org   | UPDATE: OWNER/ADMIN       |
| utilizator                      | membrii org   | OWNER/ADMIN               |
| profesor, tutor, student        | membrii org   | OWNER/ADMIN               |
| tip_contract, grupa, contract   | membrii org   | OWNER/ADMIN               |
| orar, plata                     | membrii org   | OWNER/ADMIN               |
| lectie, prezenta                | membrii org   | OWNER/ADMIN **sau** PROFESOR |
| plan                            | oricine (activ)| doar service_role        |
| abonament, factura_saas         | membrii org   | doar service_role/billing |

> MVP: `SELECT` este la nivel de organizatie pentru toti membrii. Restrangerea
> fina per rol (ex. tutorele vede doar elevii lui, elevul doar datele proprii)
> se adauga in v2.

## Autentificare & onboarding (Faza 2)

- Supabase Auth (email + parola). Sesiunea e persistata cu AsyncStorage.
- `utilizator.auth_user_id` leaga contul de `auth.users`.
- **Owner nou**: dupa signup apeleaza `onboard_organizatie(...)` care creeaza
  organizatia + abonament TRIAL (14 zile, plan Free) + contul OWNER + tarifarul
  default (Individual/Colegial/Grup). Pentru `INDEPENDENT` creeaza si profilul
  PROFESOR.
- **Invitatii**: `invite_utilizator(email, rol, nume)` (doar admin) creeaza un
  `utilizator` `INVITAT` + profilul corespunzator. Cand invitatul se
  inregistreaza cu acelasi email, triggerul `on_auth_user_created` il leaga si
  activeaza automat contul.
- **Limite plan**: triggere pe `profesor`/`student` blocheaza depasirea
  `max_profesori`/`max_elevi` din planul abonamentului activ.

## Aplicatia mobila

- `src/lib/supabase.ts` - clientul Supabase (tipizat cu `Database`).
- `src/lib/database.types.ts` - tipuri TS (regenerabile cu `supabase gen types`).
- `src/lib/ctx.tsx` - `SessionProvider` (sesiune + profil + onboarding).
- `src/lib/queries.ts` - stratul de acces la date.
- Rutare (`src/app/`), protejata cu `Stack.Protected`:
  - fara sesiune -> `sign-in`
  - sesiune fara profil -> `onboarding`
  - sesiune + profil -> grupul `(app)` (dashboard pe rol + invitatii)

## Ce urmeaza (dupa MVP)

- Ecrane CRUD complete pentru grupe/contracte/orar/lectii/prezenta/plati.
- Rol TUTOR + ELEV (view-urile din capturi).
- Faza 4: Stripe (planuri, checkout, webhooks, blocare la expirare).
- Faza 6+: notificari, export PDF/Excel, teste, CI/CD, deploy.
