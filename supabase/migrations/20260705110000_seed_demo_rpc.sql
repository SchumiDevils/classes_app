-- =============================================================================
-- RPC demo: populeaza organizatia CURENTA cu datele din foile de calcul
-- (roster elevi, grupa, contracte, orar, lectii, prezenta, plati).
--
-- Se apeleaza de un admin autentificat: datele intra in organizatia lui.
-- Idempotent: nu face nimic daca organizatia are deja elevi.
--
-- Cifrele reproduc dashboard-ul financiar din capturi:
--   balanta = ore_achitate - ore_realizate  =>  Balta 74, Iamblea 50, Lupan 30
-- =============================================================================
create or replace function public.seed_demo_data()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     bigint := app.current_org_id();
  v_prof    bigint;
  v_tc_grup bigint;
  v_grupa   bigint;
  v_tutor   bigint;
  v_balta   bigint;
  v_iamblea bigint;
  v_lupan   bigint;
  v_c_balta   bigint;
  v_c_iamblea bigint;
  v_c_lupan   bigint;
  v_lectie2 bigint;
  v_nr      int := 4;
  v_name    text;
  v_rest    text[] := array[
    'Moraras Andrei','Cretu Ecaterina','Teut Ecaterina','Savga Evelina',
    'Vicol Ariadna','Gritco Mateo','Bitca Alina','Meriniuc Marian',
    'Nogai Andrei','Baciu Madalina','Movila Cezar'
  ];
begin
  if v_org is null then
    raise exception 'Fara organizatie in context.';
  end if;
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot incarca date demo.';
  end if;
  if exists (select 1 from public.student where organizatie_id = v_org) then
    return 'Datele demo exista deja - nu am modificat nimic.';
  end if;

  -- Profesor (reutilizam profilul existent daca e cazul; altfel cream unul)
  select id into v_prof from public.profesor where organizatie_id = v_org order by id limit 1;
  if v_prof is null then
    insert into public.profesor (organizatie_id, nume_prenume, specializare)
    values (v_org, 'Profesor Demo', 'Matematica')
    returning id into v_prof;
  end if;

  -- Tip contract "Grup" (seedat la onboarding)
  select id into v_tc_grup from public.tip_contract where organizatie_id = v_org and cod = 'G';

  -- Grupa
  insert into public.grupa (organizatie_id, profesor_id, tip_contract_id, denumire)
  values (v_org, v_prof, v_tc_grup, 'Grupa Matematica (cl. 9)')
  returning id into v_grupa;

  -- Tutore
  insert into public.tutor (organizatie_id, nume_prenume, email, telefon)
  values (v_org, 'Balta Elena', 'elenab@gmail.com', '069437410')
  returning id into v_tutor;

  -- Elevi cu date financiare (Balta / Iamblea / Lupan)
  insert into public.student (organizatie_id, tutor_id, clasa, nume_prenume, email, telefon, id_sistem, id_vizual)
  values (v_org, v_tutor, '09', 'Balta Delia', 'balta.delia@gmail.com', '069257410', '001', 'bd-09-001')
  returning id into v_balta;

  insert into public.student (organizatie_id, clasa, nume_prenume, id_sistem, id_vizual)
  values (v_org, '09', 'Iamblea Alexandru', '002', 'ia-09-002')
  returning id into v_iamblea;

  insert into public.student (organizatie_id, clasa, nume_prenume, id_sistem, id_vizual)
  values (v_org, '09', 'Lupan Cezar', '003', 'lc-09-003')
  returning id into v_lupan;

  -- Restul rosterului (fara date financiare)
  foreach v_name in array v_rest loop
    insert into public.student (organizatie_id, clasa, nume_prenume, id_sistem, id_vizual)
    values (v_org, '09', v_name, lpad(v_nr::text, 3, '0'), 'v-09-' || lpad(v_nr::text, 3, '0'));
    v_nr := v_nr + 1;
  end loop;

  -- Contracte (pret_sesiune se calculeaza automat)
  --   Balta:   450 * (1 - 0.10) = 405
  --   Iamblea: 350 * (1 - 0.20) = 280
  --   Lupan:   380 * (1 - 0.00) = 380
  insert into public.contract (organizatie_id, student_id, grupa_id, data_start, pret_standard, reducere_aplicata, status)
  values (v_org, v_balta, v_grupa, date '2026-09-03', 450, 0.10, 'ACTIV') returning id into v_c_balta;
  insert into public.contract (organizatie_id, student_id, grupa_id, data_start, pret_standard, reducere_aplicata, status)
  values (v_org, v_iamblea, v_grupa, date '2026-09-03', 350, 0.20, 'ACTIV') returning id into v_c_iamblea;
  insert into public.contract (organizatie_id, student_id, grupa_id, data_start, pret_standard, reducere_aplicata, status)
  values (v_org, v_lupan, v_grupa, date '2026-09-03', 380, 0.00, 'ACTIV') returning id into v_c_lupan;

  -- Orar (din Fisa de monitorizare)
  insert into public.orar (organizatie_id, grupa_id, ziua, ora) values
    (v_org, v_grupa, 'LUNI',    time '15:45'),
    (v_org, v_grupa, 'SAMBATA', time '16:45'),
    (v_org, v_grupa, 'VINERI',  time '17:45');

  -- Lectii
  insert into public.lectie (organizatie_id, grupa_id, profesor_id, nr, data, subiect, status)
  values (v_org, v_grupa, v_prof, 1, date '2026-09-05', 'Recapitulare initiala', 'PLANIFICATA');
  insert into public.lectie (organizatie_id, grupa_id, profesor_id, nr, data, subiect, status)
  values (v_org, v_grupa, v_prof, 2, date '2026-09-07', 'Numere reale', 'REALIZATA')
  returning id into v_lectie2;
  insert into public.lectie (organizatie_id, grupa_id, profesor_id, nr, data, subiect, status)
  values (v_org, v_grupa, v_prof, 3, date '2026-09-11', 'Ecuatii de gradul I', 'PLANIFICATA');

  -- Prezenta: Balta prezenta la lectia realizata (=> ore_realizate = 1)
  insert into public.prezenta (organizatie_id, lectie_id, student_id, prezent)
  values (v_org, v_lectie2, v_balta, true);

  -- Plati (ore_achitate = suma sesiunilor):  Balta 75, Iamblea 50, Lupan 30
  insert into public.plata (organizatie_id, contract_id, student_id, data, sesiuni, suma, note) values
    (v_org, v_c_balta,   v_balta,   date '2026-06-13', 50, 50 * 405, 'Transa 1'),
    (v_org, v_c_balta,   v_balta,   date '2026-06-20', 25, 25 * 405, 'Transa 2'),
    (v_org, v_c_iamblea, v_iamblea, date '2026-06-13', 50, 50 * 280, 'Achitare'),
    (v_org, v_c_lupan,   v_lupan,   date '2026-06-13', 30, 30 * 380, 'Achitare');

  return 'Date demo incarcate: 14 elevi, 1 grupa, 3 contracte, 3 lectii, 4 plati.';
end;
$$;

grant execute on function public.seed_demo_data() to authenticated;
