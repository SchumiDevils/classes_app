-- =============================================================================
-- Faza 1/2 - Functii helper pentru tenant + Row Level Security (RLS)
--
-- Izolarea per tenant este cerinta CRITICA: fiecare utilizator vede/scrie
-- doar randurile organizatiei sale (organizatie_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: organizatia utilizatorului curent (din JWT -> auth.uid -> utilizator).
-- SECURITY DEFINER => ruleaza ca owner (postgres) si ocoleste RLS pe utilizator,
-- deci nu exista recursivitate in politici.
-- -----------------------------------------------------------------------------
create or replace function app.current_org_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select organizatie_id
  from public.utilizator
  where auth_user_id = (select auth.uid())
    and status = 'ACTIV'
  limit 1;
$$;

create or replace function app.current_rol()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select rol
  from public.utilizator
  where auth_user_id = (select auth.uid())
    and status = 'ACTIV'
  limit 1;
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rol from public.utilizator
     where auth_user_id = (select auth.uid()) and status = 'ACTIV'
     limit 1) in ('OWNER','ADMIN'),
    false
  );
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rol from public.utilizator
     where auth_user_id = (select auth.uid()) and status = 'ACTIV'
     limit 1) in ('OWNER','ADMIN','PROFESOR'),
    false
  );
$$;

grant usage on schema app to authenticated;
grant execute on function app.current_org_id() to authenticated;
grant execute on function app.current_rol()   to authenticated;
grant execute on function app.is_admin()       to authenticated;
grant execute on function app.is_staff()        to authenticated;

-- -----------------------------------------------------------------------------
-- GRANT-uri de tabela (RLS controleaza randurile, GRANT controleaza tabela).
-- In Supabase nou entitatile din `public` NU sunt auto-expuse fara GRANT.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- =============================================================================
-- Activare RLS pe TOATE tabelele
-- =============================================================================
alter table public.plan          enable row level security;
alter table public.organizatie   enable row level security;
alter table public.abonament     enable row level security;
alter table public.factura_saas  enable row level security;
alter table public.utilizator    enable row level security;
alter table public.profesor      enable row level security;
alter table public.tutor         enable row level security;
alter table public.student       enable row level security;
alter table public.tip_contract  enable row level security;
alter table public.grupa         enable row level security;
alter table public.contract      enable row level security;
alter table public.orar          enable row level security;
alter table public.lectie        enable row level security;
alter table public.prezenta      enable row level security;
alter table public.plata         enable row level security;

-- =============================================================================
-- PLAN: lizibil de oricine autentificat; scriere doar service_role (bypass RLS)
-- =============================================================================
create policy plan_select on public.plan
  for select to authenticated using (activ = true);

-- =============================================================================
-- ORGANIZATIE: membrii isi vad organizatia; doar admin o poate edita
-- =============================================================================
create policy organizatie_select on public.organizatie
  for select to authenticated using (id = app.current_org_id());
create policy organizatie_update on public.organizatie
  for update to authenticated using (id = app.current_org_id() and app.is_admin())
  with check (id = app.current_org_id());

-- =============================================================================
-- ABONAMENT / FACTURA_SAAS: doar citire de catre membrii org (scriere = billing)
-- =============================================================================
create policy abonament_select on public.abonament
  for select to authenticated using (organizatie_id = app.current_org_id());

create policy factura_select on public.factura_saas
  for select to authenticated using (
    abonament_id in (select id from public.abonament where organizatie_id = app.current_org_id())
  );

-- =============================================================================
-- UTILIZATOR: membrii vad conturile din org; doar admin gestioneaza
-- =============================================================================
create policy utilizator_select on public.utilizator
  for select to authenticated using (organizatie_id = app.current_org_id());
create policy utilizator_insert on public.utilizator
  for insert to authenticated with check (organizatie_id = app.current_org_id() and app.is_admin());
create policy utilizator_update on public.utilizator
  for update to authenticated using (organizatie_id = app.current_org_id() and app.is_admin())
  with check (organizatie_id = app.current_org_id());
create policy utilizator_delete on public.utilizator
  for delete to authenticated using (organizatie_id = app.current_org_id() and app.is_admin());

-- -----------------------------------------------------------------------------
-- Macro implicit pentru tabelele "management" (scriere = doar admin):
--   profesor, tutor, student, tip_contract, grupa, contract, orar, plata
-- SELECT: orice membru al organizatiei.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  admin_tables text[] := array[
    'profesor','tutor','student','tip_contract','grupa','contract','orar','plata'
  ];
begin
  foreach t in array admin_tables loop
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (organizatie_id = app.current_org_id());
      create policy %1$s_insert on public.%1$I
        for insert to authenticated
        with check (organizatie_id = app.current_org_id() and app.is_admin());
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using (organizatie_id = app.current_org_id() and app.is_admin())
        with check (organizatie_id = app.current_org_id());
      create policy %1$s_delete on public.%1$I
        for delete to authenticated
        using (organizatie_id = app.current_org_id() and app.is_admin());
    $f$, t);
  end loop;
end;
$$;

-- =============================================================================
-- LECTIE & PREZENTA: SELECT membrii org; scriere admin SAU profesor
-- (profesorul isi marcheaza lectiile si prezenta)
-- =============================================================================
do $$
declare
  t text;
  staff_tables text[] := array['lectie','prezenta'];
begin
  foreach t in array staff_tables loop
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (organizatie_id = app.current_org_id());
      create policy %1$s_insert on public.%1$I
        for insert to authenticated
        with check (organizatie_id = app.current_org_id() and app.is_staff());
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using (organizatie_id = app.current_org_id() and app.is_staff())
        with check (organizatie_id = app.current_org_id());
      create policy %1$s_delete on public.%1$I
        for delete to authenticated
        using (organizatie_id = app.current_org_id() and app.is_admin());
    $f$, t);
  end loop;
end;
$$;
