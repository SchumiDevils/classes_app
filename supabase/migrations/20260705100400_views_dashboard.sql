-- =============================================================================
-- Faza 3 - View-uri pentru rapoarte / dashboard
--
-- security_invoker = true => RLS-ul tabelelor de baza se aplica apelantului,
-- deci izolarea per tenant ramane garantata si prin view-uri.
--
-- Definitii (conform capturilor):
--   ore_realizate = numar de prezente (prezent=true) la lectii REALIZATE
--   ore_achitate  = suma sesiunilor platite
--   balanta       = ore_achitate - ore_realizate
--   venit         = suma sumelor incasate
-- =============================================================================

-- Dashboard per elev
create view public.v_student_dashboard
with (security_invoker = true) as
select
  s.id                                              as student_id,
  s.organizatie_id,
  s.nume_prenume,
  coalesce(r.ore_realizate, 0)                      as ore_realizate,
  coalesce(p.ore_achitate, 0)                       as ore_achitate,
  coalesce(p.ore_achitate, 0) - coalesce(r.ore_realizate, 0) as balanta,
  coalesce(p.venit, 0)                              as venit
from public.student s
left join (
  select pr.student_id, count(*)::int as ore_realizate
  from public.prezenta pr
  join public.lectie l on l.id = pr.lectie_id
  where pr.prezent = true and l.status = 'REALIZATA'
  group by pr.student_id
) r on r.student_id = s.id
left join (
  select student_id, sum(sesiuni)::int as ore_achitate, sum(suma) as venit
  from public.plata
  group by student_id
) p on p.student_id = s.id;

grant select on public.v_student_dashboard to authenticated;

-- Dashboard financiar la nivel de organizatie (totaluri)
create view public.v_org_dashboard
with (security_invoker = true) as
select
  organizatie_id,
  sum(ore_realizate)                as total_ore_realizate,
  sum(ore_achitate)                 as total_ore_achitate,
  sum(balanta)                      as balanta_totala,
  sum(venit)                        as venit_total,
  count(*) filter (where balanta < 0) as elevi_cu_restanta
from public.v_student_dashboard
group by organizatie_id;

grant select on public.v_org_dashboard to authenticated;

-- Grila lectiilor cu numarul de prezenti (pentru "Graficul Lectiilor")
create view public.v_lectie_detaliat
with (security_invoker = true) as
select
  l.id,
  l.organizatie_id,
  l.grupa_id,
  g.denumire                        as grupa,
  l.profesor_id,
  l.nr,
  l.data,
  l.subiect,
  l.status,
  l.recomandari,
  count(pr.id) filter (where pr.prezent) as nr_prezenti,
  count(pr.id)                            as nr_total
from public.lectie l
left join public.grupa g on g.id = l.grupa_id
left join public.prezenta pr on pr.lectie_id = l.id
group by l.id, g.denumire;

grant select on public.v_lectie_detaliat to authenticated;
