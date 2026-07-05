-- =============================================================================
-- Tutore vs Elev + Note de plata (datorii)
--   * tutorele raspunde de elevii lui (student.tutor_id)
--   * platile se genereaza ca "datorii" (note de plata) pe care tutorele le achita
--   * RLS strict: TUTORE vede DOAR elevii lui si datele lor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpere de rol pentru tutore (SECURITY DEFINER => ocolesc RLS, fara recursie)
-- -----------------------------------------------------------------------------
create or replace function app.current_tutor_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.tutor t
  join public.utilizator u on u.id = t.utilizator_id
  where u.auth_user_id = (select auth.uid())
    and u.status = 'ACTIV'
  limit 1;
$$;

create or replace function app.tutore_are_student(p_student_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.student s
    where s.id = p_student_id
      and s.tutor_id = app.current_tutor_id()
  );
$$;

create or replace function app.tutore_are_grupa(p_grupa_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contract c
    join public.student s on s.id = c.student_id
    where c.grupa_id = p_grupa_id
      and s.tutor_id = app.current_tutor_id()
  );
$$;

grant execute on function app.current_tutor_id()            to authenticated;
grant execute on function app.tutore_are_student(bigint)    to authenticated;
grant execute on function app.tutore_are_grupa(bigint)      to authenticated;

-- =============================================================================
-- Tabel DATORIE (nota de plata generata pentru un elev)
-- =============================================================================
create table public.datorie (
  id             bigint generated always as identity primary key,
  organizatie_id bigint not null references public.organizatie(id) on delete cascade,
  student_id     bigint not null references public.student(id) on delete cascade,
  contract_id    bigint references public.contract(id) on delete set null,
  data           date   not null default current_date,
  scadenta       date,
  sesiuni        int    not null default 0 check (sesiuni >= 0),
  suma           numeric(10,2) not null default 0 check (suma >= 0),
  status         text   not null default 'NEACHITATA' check (status in ('NEACHITATA','ACHITATA','ANULATA')),
  plata_id       bigint references public.plata(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.datorie is 'Nota de plata generata pentru un elev; tutorele o achita.';

create index idx_datorie_org     on public.datorie(organizatie_id);
create index idx_datorie_student on public.datorie(student_id);
create index idx_datorie_status  on public.datorie(status);

create trigger trg_datorie_set_tenant before insert on public.datorie
  for each row execute function app.set_tenant_id();
create trigger trg_datorie_updated before update on public.datorie
  for each row execute function app.set_updated_at();

grant select, insert, update, delete on public.datorie to authenticated;
alter table public.datorie enable row level security;

-- =============================================================================
-- RLS pe roluri: rescriem politicile SELECT sensibile (staff vede tot; tutorele
-- doar elevii lui). grupa/orar/tip_contract/profesor raman date de referinta.
-- =============================================================================
drop policy if exists student_select    on public.student;
drop policy if exists plata_select      on public.plata;
drop policy if exists contract_select   on public.contract;
drop policy if exists prezenta_select   on public.prezenta;
drop policy if exists lectie_select     on public.lectie;
drop policy if exists tutor_select      on public.tutor;
drop policy if exists utilizator_select on public.utilizator;

create policy student_select on public.student
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or tutor_id = app.current_tutor_id())
  );

create policy plata_select on public.plata
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or app.tutore_are_student(student_id))
  );

create policy contract_select on public.contract
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or app.tutore_are_student(student_id))
  );

create policy prezenta_select on public.prezenta
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or app.tutore_are_student(student_id))
  );

create policy lectie_select on public.lectie
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or app.tutore_are_grupa(grupa_id))
  );

create policy tutor_select on public.tutor
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or id = app.current_tutor_id())
  );

create policy utilizator_select on public.utilizator
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or auth_user_id = (select auth.uid()))
  );

-- Politici DATORIE
create policy datorie_select on public.datorie
  for select to authenticated
  using (
    organizatie_id = app.current_org_id()
    and (app.is_staff() or app.tutore_are_student(student_id))
  );
create policy datorie_insert on public.datorie
  for insert to authenticated
  with check (organizatie_id = app.current_org_id() and app.is_admin());
create policy datorie_update on public.datorie
  for update to authenticated
  using (organizatie_id = app.current_org_id() and app.is_admin())
  with check (organizatie_id = app.current_org_id());
create policy datorie_delete on public.datorie
  for delete to authenticated
  using (organizatie_id = app.current_org_id() and app.is_admin());

-- =============================================================================
-- RPC-uri: generare & achitare note de plata
-- =============================================================================

-- Genereaza o nota pentru un elev (sesiuni datorate x pret_sesiune).
--   owed = ore_realizate - ore_achitate - sesiuni din datorii NEACHITATE
create or replace function public.genereaza_datorie(p_student_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org       bigint := app.current_org_id();
  v_realizate int;
  v_achitate  int;
  v_neachitat int;
  v_owed      int;
  v_contract  bigint;
  v_pret      numeric;
  v_id        bigint;
begin
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot genera note de plata.';
  end if;
  if not exists (select 1 from public.student where id = p_student_id and organizatie_id = v_org) then
    raise exception 'Elev inexistent in organizatie.';
  end if;

  select coalesce(count(*), 0) into v_realizate
    from public.prezenta pr
    join public.lectie l on l.id = pr.lectie_id
   where pr.student_id = p_student_id and pr.prezent = true and l.status = 'REALIZATA';

  select coalesce(sum(sesiuni), 0) into v_achitate
    from public.plata where student_id = p_student_id;

  select coalesce(sum(sesiuni), 0) into v_neachitat
    from public.datorie where student_id = p_student_id and status = 'NEACHITATA';

  v_owed := v_realizate - v_achitate - v_neachitat;
  if v_owed <= 0 then
    return null;
  end if;

  select id, pret_sesiune into v_contract, v_pret
    from public.contract where student_id = p_student_id
    order by data_start desc limit 1;
  v_pret := coalesce(v_pret, 0);

  insert into public.datorie (organizatie_id, student_id, contract_id, sesiuni, suma, status)
  values (v_org, p_student_id, v_contract, v_owed, round(v_owed * v_pret, 2), 'NEACHITATA')
  returning id into v_id;

  return v_id;
end;
$$;

-- Genereaza note pentru toti elevii cu datorii; intoarce cate note s-au creat.
create or replace function public.genereaza_datorii()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   bigint := app.current_org_id();
  v_count int := 0;
  r       record;
  v_id    bigint;
begin
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot genera note de plata.';
  end if;
  for r in select id from public.student where organizatie_id = v_org loop
    v_id := public.genereaza_datorie(r.id);
    if v_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Achita o nota: creeaza PLATA + marcheaza datoria ACHITATA.
-- Permis adminului SAU tutorelui elevului respectiv.
create or replace function public.achita_datorie(p_datorie_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   bigint := app.current_org_id();
  v_d     public.datorie%rowtype;
  v_plata bigint;
begin
  select * into v_d from public.datorie where id = p_datorie_id and organizatie_id = v_org;
  if not found then
    raise exception 'Nota de plata inexistenta.';
  end if;
  if not (app.is_admin() or app.tutore_are_student(v_d.student_id)) then
    raise exception 'Nu ai dreptul sa achiti aceasta nota.';
  end if;
  if v_d.status <> 'NEACHITATA' then
    raise exception 'Nota nu este NEACHITATA.';
  end if;

  insert into public.plata (organizatie_id, contract_id, student_id, data, sesiuni, suma, note)
  values (v_org, v_d.contract_id, v_d.student_id, current_date, v_d.sesiuni, v_d.suma,
          'Achitare nota #' || v_d.id)
  returning id into v_plata;

  update public.datorie set status = 'ACHITATA', plata_id = v_plata where id = p_datorie_id;

  return v_plata;
end;
$$;

-- Anuleaza o nota NEACHITATA (doar admin).
create or replace function public.anuleaza_datorie(p_datorie_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org bigint := app.current_org_id();
begin
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot anula note de plata.';
  end if;
  update public.datorie
     set status = 'ANULATA'
   where id = p_datorie_id and organizatie_id = v_org and status = 'NEACHITATA';
end;
$$;

grant execute on function public.genereaza_datorie(bigint) to authenticated;
grant execute on function public.genereaza_datorii()       to authenticated;
grant execute on function public.achita_datorie(bigint)    to authenticated;
grant execute on function public.anuleaza_datorie(bigint)  to authenticated;
