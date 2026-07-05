-- =============================================================================
-- Faza 1 - Schema de baza (multi-tenant)
-- Centru de lectii private / SaaS
--
-- Conventii:
--   * Toate tabelele de business au `organizatie_id` (izolare per tenant).
--   * PK-uri surogate `bigint generated always as identity` peste tot
--     (inclusiv STUDENT, pentru integritate referentiala curata).
--   * Identificatorii de business (id_sistem, id_vizual) sunt atribute unice
--     per organizatie, nu chei primare.
--   * Reducerile sunt stocate ca fractii zecimale (0.10 = 10%).
-- =============================================================================

-- Schema interna pentru functii helper (NU e expusa prin API).
create schema if not exists app;

-- -----------------------------------------------------------------------------
-- Utilitar: coloana updated_at auto-actualizata
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- NIVEL SaaS (global + per organizatie)
-- =============================================================================

-- PLAN (global, fara organizatie_id)
create table public.plan (
  id             bigint generated always as identity primary key,
  nume           text        not null unique,
  pret_lunar     numeric(10,2) not null default 0 check (pret_lunar >= 0),
  pret_anual     numeric(10,2) not null default 0 check (pret_anual >= 0),
  max_profesori  int          check (max_profesori is null or max_profesori >= 0),
  max_elevi      int          check (max_elevi is null or max_elevi >= 0),
  functii        jsonb        not null default '{}'::jsonb,
  stripe_price_lunar text,
  stripe_price_anual text,
  activ          boolean      not null default true,
  created_at     timestamptz  not null default now()
);
comment on table public.plan is 'Planuri de abonament SaaS (Free/Pro/Enterprise). Global, fara tenant.';
comment on column public.plan.max_profesori is 'NULL = nelimitat';
comment on column public.plan.max_elevi is 'NULL = nelimitat';

-- ORGANIZATIE (tenant-ul propriu-zis)
create table public.organizatie (
  id                bigint generated always as identity primary key,
  nume              text        not null,
  tip               text        not null check (tip in ('COMPANIE','INDEPENDENT')),
  email_contact     text,
  telefon           text,
  data_inregistrare date        not null default current_date,
  status            text        not null default 'ACTIV' check (status in ('ACTIV','SUSPENDAT','INACTIV')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.organizatie is 'Tenant: firma de meditatii sau profesor independent.';

-- ABONAMENT (organizatie -> plan)
create table public.abonament (
  id               bigint generated always as identity primary key,
  organizatie_id   bigint not null references public.organizatie(id) on delete cascade,
  plan_id          bigint not null references public.plan(id) on delete restrict,
  data_start       date   not null default current_date,
  data_expirare    date,
  ciclu_facturare  text   not null default 'LUNAR' check (ciclu_facturare in ('LUNAR','ANUAL')),
  status           text   not null default 'TRIAL' check (status in ('TRIAL','ACTIV','EXPIRAT','ANULAT')),
  stripe_subscription_id text,
  stripe_customer_id     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint abonament_perioada_valida check (data_expirare is null or data_expirare >= data_start)
);
comment on table public.abonament is 'Abonamentul SaaS activ al unei organizatii.';

-- FACTURA_SAAS (abonament -> facturi)
create table public.factura_saas (
  id             bigint generated always as identity primary key,
  abonament_id   bigint not null references public.abonament(id) on delete cascade,
  data           date   not null default current_date,
  suma           numeric(10,2) not null default 0 check (suma >= 0),
  status_plata   text   not null default 'NEACHITATA' check (status_plata in ('PLATITA','NEACHITATA','ANULATA')),
  stripe_invoice_id text,
  created_at     timestamptz not null default now()
);
comment on table public.factura_saas is 'Facturi generate pentru abonamentele SaaS.';

-- =============================================================================
-- CONTURI & PROFILURI (per tenant)
-- =============================================================================

-- UTILIZATOR (cont de aplicatie, legat de auth.users prin auth_user_id)
create table public.utilizator (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  auth_user_id   uuid   unique references auth.users(id) on delete set null,
  nume_prenume   text   not null,
  email          text   not null,
  rol            text   not null check (rol in ('OWNER','ADMIN','PROFESOR','TUTOR','STUDENT')),
  status         text   not null default 'INVITAT' check (status in ('ACTIV','INVITAT','SUSPENDAT')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint utilizator_email_unic_per_org unique (organizatie_id, email)
);
comment on table public.utilizator is 'Cont de aplicatie. Parola este gestionata de Supabase Auth (auth.users).';
comment on column public.utilizator.auth_user_id is 'Legatura catre auth.users. NULL pana la acceptarea invitatiei.';

-- PROFESOR
create table public.profesor (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  utilizator_id  bigint unique references public.utilizator(id) on delete set null,
  nume_prenume   text   not null,
  specializare   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- TUTOR
create table public.tutor (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  utilizator_id  bigint unique references public.utilizator(id) on delete set null,
  nume_prenume   text   not null,
  email          text,
  telefon        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- STUDENT
create table public.student (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  utilizator_id  bigint unique references public.utilizator(id) on delete set null,
  tutor_id       bigint references public.tutor(id) on delete set null,
  id_recomandare bigint references public.student(id) on delete set null,
  id_sistem      text,
  id_vizual      text,
  clasa          text,
  nume_prenume   text   not null,
  email          text,
  telefon        text,
  status         text   not null default 'ACTIV' check (status in ('ACTIV','INACTIV','ABSOLVIT')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint student_id_sistem_unic_per_org unique (organizatie_id, id_sistem),
  constraint student_id_vizual_unic_per_org unique (organizatie_id, id_vizual),
  constraint student_fara_autoreferral check (id_recomandare is null or id_recomandare <> id)
);
comment on column public.student.id_recomandare is 'Studentul care l-a recomandat (referral).';

-- =============================================================================
-- BUSINESS: contracte, grupe, orar, lectii, prezenta, plati
-- =============================================================================

-- TIP_CONTRACT (tarifar per organizatie)
create table public.tip_contract (
  id                  bigint generated always as identity primary key,
  organizatie_id      bigint not null references public.organizatie(id) on delete cascade,
  cod                 text   not null,
  denumire            text   not null,
  pret_standard       numeric(10,2) not null default 0 check (pret_standard >= 0),
  ore_minime          int    not null default 0 check (ore_minime >= 0),
  reducere_loialitate numeric(5,4) not null default 0 check (reducere_loialitate between 0 and 1),
  reducere_referral   numeric(5,4) not null default 0 check (reducere_referral between 0 and 1),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint tip_contract_cod_unic_per_org unique (organizatie_id, cod)
);
comment on column public.tip_contract.reducere_loialitate is 'Fractie zecimala (0.10 = 10%).';

-- GRUPA
create table public.grupa (
  id              bigint generated always as identity primary key,
  organizatie_id  bigint not null references public.organizatie(id) on delete cascade,
  profesor_id     bigint references public.profesor(id) on delete set null,
  tip_contract_id bigint references public.tip_contract(id) on delete set null,
  denumire        text   not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- CONTRACT (inscrierea unui student intr-o grupa)
create table public.contract (
  id                bigint generated always as identity primary key,
  organizatie_id    bigint not null references public.organizatie(id) on delete cascade,
  student_id        bigint not null references public.student(id) on delete cascade,
  grupa_id          bigint references public.grupa(id) on delete set null,
  data_start        date   not null default current_date,
  pret_standard     numeric(10,2) not null default 0 check (pret_standard >= 0),
  reducere_aplicata numeric(5,4)  not null default 0 check (reducere_aplicata between 0 and 1),
  -- pret_sesiune = pret_standard * (1 - reducere_aplicata), rotunjit la 2 zecimale
  pret_sesiune      numeric(10,2) generated always as (round(pret_standard * (1 - reducere_aplicata), 2)) stored,
  status            text   not null default 'ACTIV' check (status in ('ACTIV','FINALIZAT','ANULAT')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on column public.contract.pret_sesiune is 'Calculat automat: pret_standard * (1 - reducere_aplicata).';

-- ORAR (program saptamanal per grupa)
create table public.orar (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  grupa_id       bigint not null references public.grupa(id) on delete cascade,
  ziua           text   not null check (ziua in ('LUNI','MARTI','MIERCURI','JOI','VINERI','SAMBATA','DUMINICA')),
  ora            time   not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint orar_slot_unic unique (grupa_id, ziua, ora)
);

-- LECTIE
create table public.lectie (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  grupa_id       bigint not null references public.grupa(id) on delete cascade,
  profesor_id    bigint references public.profesor(id) on delete set null,
  nr             int,
  data           date,
  subiect        text,
  status         text   not null default 'PLANIFICATA' check (status in ('PLANIFICATA','REALIZATA','ANULATA')),
  recomandari    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- PREZENTA (per elev per lectie)
create table public.prezenta (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  lectie_id      bigint not null references public.lectie(id) on delete cascade,
  student_id     bigint not null references public.student(id) on delete cascade,
  prezent        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint prezenta_unica_per_lectie_student unique (lectie_id, student_id)
);

-- PLATA
create table public.plata (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  contract_id    bigint references public.contract(id) on delete set null,
  student_id     bigint not null references public.student(id) on delete cascade,
  data           date   not null default current_date,
  sesiuni        int    not null default 0 check (sesiuni >= 0),
  suma           numeric(10,2) not null default 0 check (suma >= 0),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =============================================================================
-- INDEXURI (organizatie_id + FK-uri interogate frecvent)
-- =============================================================================
create index idx_abonament_org        on public.abonament(organizatie_id);
create index idx_abonament_plan       on public.abonament(plan_id);
create index idx_factura_abonament    on public.factura_saas(abonament_id);

create index idx_utilizator_org       on public.utilizator(organizatie_id);
create index idx_utilizator_auth      on public.utilizator(auth_user_id);
create index idx_utilizator_email     on public.utilizator(lower(email));

create index idx_profesor_org         on public.profesor(organizatie_id);
create index idx_tutor_org            on public.tutor(organizatie_id);

create index idx_student_org          on public.student(organizatie_id);
create index idx_student_tutor        on public.student(tutor_id);
create index idx_student_recomandare  on public.student(id_recomandare);

create index idx_tip_contract_org     on public.tip_contract(organizatie_id);
create index idx_grupa_org            on public.grupa(organizatie_id);
create index idx_grupa_profesor       on public.grupa(profesor_id);
create index idx_grupa_tip_contract   on public.grupa(tip_contract_id);

create index idx_contract_org         on public.contract(organizatie_id);
create index idx_contract_student     on public.contract(student_id);
create index idx_contract_grupa       on public.contract(grupa_id);

create index idx_orar_org             on public.orar(organizatie_id);
create index idx_orar_grupa           on public.orar(grupa_id);

create index idx_lectie_org           on public.lectie(organizatie_id);
create index idx_lectie_grupa         on public.lectie(grupa_id);
create index idx_lectie_profesor      on public.lectie(profesor_id);
create index idx_lectie_data          on public.lectie(data);

create index idx_prezenta_org         on public.prezenta(organizatie_id);
create index idx_prezenta_lectie      on public.prezenta(lectie_id);
create index idx_prezenta_student     on public.prezenta(student_id);

create index idx_plata_org            on public.plata(organizatie_id);
create index idx_plata_contract       on public.plata(contract_id);
create index idx_plata_student        on public.plata(student_id);

-- =============================================================================
-- Triggere updated_at
-- =============================================================================
create trigger trg_organizatie_updated  before update on public.organizatie  for each row execute function app.set_updated_at();
create trigger trg_abonament_updated     before update on public.abonament     for each row execute function app.set_updated_at();
create trigger trg_utilizator_updated    before update on public.utilizator    for each row execute function app.set_updated_at();
create trigger trg_profesor_updated      before update on public.profesor      for each row execute function app.set_updated_at();
create trigger trg_tutor_updated         before update on public.tutor         for each row execute function app.set_updated_at();
create trigger trg_student_updated       before update on public.student       for each row execute function app.set_updated_at();
create trigger trg_tip_contract_updated  before update on public.tip_contract  for each row execute function app.set_updated_at();
create trigger trg_grupa_updated         before update on public.grupa         for each row execute function app.set_updated_at();
create trigger trg_contract_updated      before update on public.contract      for each row execute function app.set_updated_at();
create trigger trg_orar_updated          before update on public.orar          for each row execute function app.set_updated_at();
create trigger trg_lectie_updated        before update on public.lectie        for each row execute function app.set_updated_at();
create trigger trg_prezenta_updated      before update on public.prezenta      for each row execute function app.set_updated_at();
create trigger trg_plata_updated         before update on public.plata         for each row execute function app.set_updated_at();
