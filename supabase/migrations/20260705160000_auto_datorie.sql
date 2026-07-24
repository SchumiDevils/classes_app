-- =============================================================================
-- Auto-generare note de plata (datorii) cand o lectie devine REALIZATA.
--
--   * helper `app.sync_datorie_student` recalculeaza restanta si creeaza o
--     `datorie` NEACHITATA daca owed > 0 (idempotent: scade datoriile existente);
--   * trigger pe `lectie` cand status -> REALIZATA (pt. toti elevii prezenti);
--   * trigger pe `prezenta` cand se marcheaza prezent la o lectie deja REALIZATA
--     (acopera si ordinea inversa: intai realizata, apoi prezenta);
--   * `genereaza_datorie` (RPC admin) e refactorizat sa refoloseasca helperul.
--
-- Nota: stergerea unei prezente / anularea unei lectii NU sterge automat notele
-- deja generate (raman de anulat manual din admin) - MVP.
-- =============================================================================

-- Helper intern (fara verificare de rol - apelat din triggere si din RPC).
create or replace function app.sync_datorie_student(p_student_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org       bigint;
  v_realizate int;
  v_achitate  int;
  v_neachitat int;
  v_owed      int;
  v_contract  bigint;
  v_pret      numeric;
  v_id        bigint;
begin
  select organizatie_id into v_org from public.student where id = p_student_id;
  if v_org is null then
    return null;
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

  insert into public.datorie (organizatie_id, student_id, contract_id, sesiuni, suma, status, note)
  values (v_org, p_student_id, v_contract, v_owed, round(v_owed * v_pret, 2), 'NEACHITATA', 'Generată automat')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function app.sync_datorie_student(bigint) to authenticated;

-- Refactor: RPC-ul admin refoloseste helperul (pastreaza verificarea de rol).
create or replace function public.genereaza_datorie(p_student_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org bigint := app.current_org_id();
begin
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot genera note de plata.';
  end if;
  if not exists (select 1 from public.student where id = p_student_id and organizatie_id = v_org) then
    raise exception 'Elev inexistent in organizatie.';
  end if;
  return app.sync_datorie_student(p_student_id);
end;
$$;

-- Trigger 1: lectie -> REALIZATA => genereaza pentru elevii prezenti.
create or replace function app.trg_lectie_realizata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status = 'REALIZATA' and (old.status is distinct from 'REALIZATA') then
    for r in
      select student_id from public.prezenta
      where lectie_id = new.id and prezent = true
    loop
      perform app.sync_datorie_student(r.student_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lectie_realizata on public.lectie;
create trigger trg_lectie_realizata
  after update on public.lectie
  for each row execute function app.trg_lectie_realizata();

-- Trigger 2: prezenta la o lectie deja REALIZATA => genereaza pentru elev.
create or replace function app.trg_prezenta_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if new.prezent = true then
    select status into v_status from public.lectie where id = new.lectie_id;
    if v_status = 'REALIZATA' then
      perform app.sync_datorie_student(new.student_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prezenta_sync on public.prezenta;
create trigger trg_prezenta_sync
  after insert or update on public.prezenta
  for each row execute function app.trg_prezenta_sync();
