-- =============================================================================
-- RPC: sterge datele de test/demo din organizatia CURENTA.
--   * sterge elevi, grupe, contracte, orar, lectii, prezente, plati, datorii;
--   * pastreaza conturile (utilizator) si tarifarul (tip_contract);
--   * profilurile tutor/profesor legate de un cont real (utilizator_id not null)
--     sunt pastrate; doar cele demo (fara cont) se sterg.
-- Doar OWNER/ADMIN.
-- =============================================================================
create or replace function public.sterge_date_demo()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    bigint := app.current_org_id();
  v_elevi  int;
begin
  if v_org is null then
    raise exception 'Fara organizatie in context.';
  end if;
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot sterge datele de test.';
  end if;

  select count(*) into v_elevi from public.student where organizatie_id = v_org;

  -- Ordine explicita (desi majoritatea au ON DELETE CASCADE de la student/grupa).
  delete from public.datorie  where organizatie_id = v_org;
  delete from public.plata    where organizatie_id = v_org;
  delete from public.prezenta where organizatie_id = v_org;
  delete from public.lectie   where organizatie_id = v_org;
  delete from public.orar     where organizatie_id = v_org;
  delete from public.contract where organizatie_id = v_org;
  delete from public.student  where organizatie_id = v_org;
  delete from public.grupa    where organizatie_id = v_org;
  delete from public.tutor    where organizatie_id = v_org and utilizator_id is null;
  delete from public.profesor where organizatie_id = v_org and utilizator_id is null;

  return 'Datele de test au fost sterse (' || v_elevi || ' elevi si datele asociate).';
end;
$$;

grant execute on function public.sterge_date_demo() to authenticated;
