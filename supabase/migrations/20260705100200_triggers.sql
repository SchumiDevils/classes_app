-- =============================================================================
-- Faza 1/2 - Triggere de business
--   1) Setare automata organizatie_id la INSERT
--   2) Legare auth.users -> utilizator la signup (acceptare invitatie)
--   3) Verificarea limitelor din PLAN (max_profesori / max_elevi)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Auto organizatie_id: daca nu e furnizat la INSERT, il completam din contextul
--    utilizatorului curent. RLS (with check) valideaza apoi apartenenta.
-- -----------------------------------------------------------------------------
create or replace function app.set_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organizatie_id is null then
    new.organizatie_id := app.current_org_id();
  end if;
  if new.organizatie_id is null then
    raise exception 'organizatie_id nu poate fi determinat pentru randul nou (utilizator fara organizatie).';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  tenant_tables text[] := array[
    'utilizator','profesor','tutor','student','tip_contract',
    'grupa','contract','orar','lectie','prezenta','plata'
  ];
begin
  foreach t in array tenant_tables loop
    execute format(
      'create trigger trg_%1$s_set_tenant before insert on public.%1$I
         for each row execute function app.set_tenant_id();', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Legare auth.users -> utilizator la signup.
--    Daca exista o invitatie (utilizator INVITAT cu acelasi email si fara cont),
--    o activam si o legam de noul cont auth. Owner-ul isi creeaza organizatia
--    ulterior prin RPC onboard_organizatie().
-- -----------------------------------------------------------------------------
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.utilizator u
     set auth_user_id = new.id,
         status = 'ACTIV'
   where u.auth_user_id is null
     and u.status = 'INVITAT'
     and lower(u.email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 3) Verificarea limitelor din PLAN la crearea de profesori / elevi.
-- -----------------------------------------------------------------------------
create or replace function app.enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
  v_count int;
  v_entitate text;
begin
  -- Independent de ordinea triggerelor BEFORE INSERT, asiguram organizatie_id.
  if new.organizatie_id is null then
    new.organizatie_id := app.current_org_id();
  end if;

  if tg_table_name = 'profesor' then
    select max_profesori into v_limit
      from public.abonament a
      join public.plan p on p.id = a.plan_id
     where a.organizatie_id = new.organizatie_id
       and a.status in ('TRIAL','ACTIV')
     order by a.data_start desc
     limit 1;
    v_entitate := 'profesori';
    select count(*) into v_count from public.profesor where organizatie_id = new.organizatie_id;
  else
    select max_elevi into v_limit
      from public.abonament a
      join public.plan p on p.id = a.plan_id
     where a.organizatie_id = new.organizatie_id
       and a.status in ('TRIAL','ACTIV')
     order by a.data_start desc
     limit 1;
    v_entitate := 'elevi';
    select count(*) into v_count from public.student where organizatie_id = new.organizatie_id;
  end if;

  -- v_limit NULL => nelimitat (sau fara abonament activ; nu blocam in acest caz)
  if v_limit is not null and v_count >= v_limit then
    raise exception 'Limita planului atinsa: maxim % % permisi in abonamentul curent.', v_limit, v_entitate
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_profesor_plan_limit
  before insert on public.profesor
  for each row execute function app.enforce_plan_limit();

create trigger trg_student_plan_limit
  before insert on public.student
  for each row execute function app.enforce_plan_limit();
