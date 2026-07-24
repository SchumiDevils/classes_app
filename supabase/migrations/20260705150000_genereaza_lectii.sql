-- =============================================================================
-- RPC: genereaza lectii pentru o grupa pe un interval, pe baza orarului
-- saptamanal (tabelul `orar`). Evita duplicatele (o singura lectie / zi / grupa).
-- Staff-only (OWNER/ADMIN/PROFESOR).
-- =============================================================================

-- ziua (enum textual) -> zi a saptamanii ca in Postgres (dow): duminica = 0.
create or replace function app.dow_din_ziua(p_ziua text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_ziua
    when 'DUMINICA' then 0
    when 'LUNI'     then 1
    when 'MARTI'    then 2
    when 'MIERCURI' then 3
    when 'JOI'      then 4
    when 'VINERI'   then 5
    when 'SAMBATA'  then 6
  end;
$$;

create or replace function public.genereaza_lectii(
  p_grupa_id     bigint,
  p_data_start   date,
  p_data_sfarsit date,
  p_profesor_id  bigint default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   bigint := app.current_org_id();
  v_count int := 0;
  v_nr    int;
  v_prof  bigint;
  d       date;
begin
  if not app.is_staff() then
    raise exception 'Doar OWNER/ADMIN/PROFESOR pot genera lectii.';
  end if;
  if not exists (select 1 from public.grupa where id = p_grupa_id and organizatie_id = v_org) then
    raise exception 'Grupa inexistenta in organizatie.';
  end if;
  if p_data_start is null or p_data_sfarsit is null or p_data_sfarsit < p_data_start then
    raise exception 'Interval de date invalid.';
  end if;
  if (p_data_sfarsit - p_data_start) > 366 then
    raise exception 'Intervalul este prea mare (max 1 an).';
  end if;

  select coalesce(p_profesor_id, profesor_id) into v_prof
    from public.grupa where id = p_grupa_id;

  select coalesce(max(nr), 0) into v_nr
    from public.lectie where grupa_id = p_grupa_id;

  for d in
    select gs::date
    from generate_series(p_data_start, p_data_sfarsit, interval '1 day') as gs
  loop
    if exists (
      select 1 from public.orar o
      where o.grupa_id = p_grupa_id
        and app.dow_din_ziua(o.ziua) = extract(dow from d)::int
    )
    and not exists (
      select 1 from public.lectie l where l.grupa_id = p_grupa_id and l.data = d
    )
    then
      v_nr := v_nr + 1;
      insert into public.lectie (organizatie_id, grupa_id, profesor_id, nr, data, status)
      values (v_org, p_grupa_id, v_prof, v_nr, d, 'PLANIFICATA');
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.genereaza_lectii(bigint, date, date, bigint) to authenticated;
