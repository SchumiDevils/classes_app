-- =============================================================================
-- Faza 1/4 - Seed planuri SaaS (date de referinta, globale)
-- Idempotent: se poate re-rula fara efecte secundare.
-- Preturile sunt orientative (RON/luna) si se sincronizeaza ulterior cu Stripe.
-- =============================================================================

insert into public.plan (nume, pret_lunar, pret_anual, max_profesori, max_elevi, functii)
values
  ('Free',      0,    0,    1,    15,   '{"rapoarte": false, "export": false, "notificari": false}'::jsonb),
  ('Pro',       149,  1490, 10,   200,  '{"rapoarte": true,  "export": true,  "notificari": true}'::jsonb),
  ('Enterprise',499,  4990, null, null, '{"rapoarte": true,  "export": true,  "notificari": true, "suport_prioritar": true}'::jsonb)
on conflict (nume) do update
  set pret_lunar    = excluded.pret_lunar,
      pret_anual    = excluded.pret_anual,
      max_profesori = excluded.max_profesori,
      max_elevi     = excluded.max_elevi,
      functii       = excluded.functii;
