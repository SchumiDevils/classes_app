-- =============================================================================
-- Faza 2/3 - RPC-uri: onboarding organizatie, invitatii + logica de business
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Seed intern: creeaza tarifarul default (Individual / Colegial / Grup) pentru o
-- organizatie noua. Valorile reflecta tabela "Pricing" din foaia de calcul.
-- -----------------------------------------------------------------------------
create or replace function app.seed_tip_contract(p_org_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tip_contract
    (organizatie_id, cod, denumire, pret_standard, ore_minime, reducere_loialitate, reducere_referral)
  values
    (p_org_id, 'I', 'Individual', 450, 21, 0.05, 0.05),
    (p_org_id, 'C', 'Colegial',   350, 41, 0.10, 0.05),
    (p_org_id, 'G', 'Grup',       250, 61, 0.15, 0.05)
  on conflict (organizatie_id, cod) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Onboarding: creeaza organizatia + abonament TRIAL + contul OWNER + tarifar.
-- Pentru profesor independent creeaza si profilul PROFESOR.
-- Se apeleaza dupa signup (utilizatorul e deja autentificat).
-- -----------------------------------------------------------------------------
create or replace function public.onboard_organizatie(
  p_nume_organizatie text,
  p_tip              text,                  -- 'COMPANIE' | 'INDEPENDENT'
  p_nume_prenume     text,
  p_specializare     text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_org   bigint;
  v_plan  bigint;
  v_user  bigint;
begin
  if v_uid is null then
    raise exception 'Trebuie sa fii autentificat pentru onboarding.';
  end if;

  if exists (select 1 from public.utilizator where auth_user_id = v_uid) then
    raise exception 'Acest cont este deja asociat unei organizatii.';
  end if;

  if p_tip not in ('COMPANIE','INDEPENDENT') then
    raise exception 'Tip organizatie invalid: %', p_tip;
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.organizatie (nume, tip, email_contact)
  values (p_nume_organizatie, p_tip, v_email)
  returning id into v_org;

  -- Abonament TRIAL de 14 zile pe planul gratuit (fallback: cel mai ieftin).
  select id into v_plan from public.plan
   where activ = true
   order by (nume = 'Free') desc, pret_lunar asc
   limit 1;

  if v_plan is not null then
    insert into public.abonament (organizatie_id, plan_id, ciclu_facturare, status, data_expirare)
    values (v_org, v_plan, 'LUNAR', 'TRIAL', current_date + interval '14 days');
  end if;

  insert into public.utilizator (organizatie_id, auth_user_id, nume_prenume, email, rol, status)
  values (v_org, v_uid, p_nume_prenume, v_email, 'OWNER', 'ACTIV')
  returning id into v_user;

  perform app.seed_tip_contract(v_org);

  if p_tip = 'INDEPENDENT' then
    insert into public.profesor (organizatie_id, utilizator_id, nume_prenume, specializare)
    values (v_org, v_user, p_nume_prenume, p_specializare);
  end if;

  return v_org;
end;
$$;

grant execute on function public.onboard_organizatie(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Invitatie utilizator: adminul invita un membru pe email.
-- Creeaza randul UTILIZATOR (status INVITAT) si, dupa caz, profilul asociat.
-- Cand invitatul se inregistreaza cu acelasi email, triggerul de signup il leaga.
-- -----------------------------------------------------------------------------
create or replace function public.invite_utilizator(
  p_email        text,
  p_rol          text,                  -- 'ADMIN' | 'PROFESOR' | 'TUTOR' | 'STUDENT'
  p_nume_prenume text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org  bigint := app.current_org_id();
  v_user bigint;
begin
  if v_org is null then
    raise exception 'Fara organizatie in context.';
  end if;
  if not app.is_admin() then
    raise exception 'Doar OWNER/ADMIN pot invita utilizatori.';
  end if;
  if p_rol not in ('ADMIN','PROFESOR','TUTOR','STUDENT') then
    raise exception 'Rol invalid: %', p_rol;
  end if;

  insert into public.utilizator (organizatie_id, nume_prenume, email, rol, status)
  values (v_org, p_nume_prenume, p_email, p_rol, 'INVITAT')
  returning id into v_user;

  if p_rol = 'PROFESOR' then
    insert into public.profesor (organizatie_id, utilizator_id, nume_prenume)
    values (v_org, v_user, p_nume_prenume);
  elsif p_rol = 'TUTOR' then
    insert into public.tutor (organizatie_id, utilizator_id, nume_prenume, email)
    values (v_org, v_user, p_nume_prenume, p_email);
  elsif p_rol = 'STUDENT' then
    insert into public.student (organizatie_id, utilizator_id, nume_prenume, email)
    values (v_org, v_user, p_nume_prenume, p_email);
  end if;

  return v_user;
end;
$$;

grant execute on function public.invite_utilizator(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Profilul utilizatorului curent (folosit de app pentru rutare pe roluri).
-- -----------------------------------------------------------------------------
create or replace function public.get_profil_curent()
returns table (
  utilizator_id  bigint,
  organizatie_id bigint,
  nume_prenume   text,
  email          text,
  rol            text,
  status         text,
  organizatie    text,
  tip_organizatie text
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.organizatie_id, u.nume_prenume, u.email, u.rol, u.status,
         o.nume, o.tip
  from public.utilizator u
  join public.organizatie o on o.id = u.organizatie_id
  where u.auth_user_id = (select auth.uid())
  limit 1;
$$;

grant execute on function public.get_profil_curent() to authenticated;
