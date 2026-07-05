-- =============================================================================
-- Invitatie utilizator - robust:
--   * mesaje clare (email deja folosit, rol invalid, fara drepturi)
--   * daca exista deja o INVITATIE nefinalizata cu acelasi email, o refolosim
--     (actualizam rol/nume) in loc sa esuam pe constrangerea de unicitate.
-- =============================================================================
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
  v_org      bigint := app.current_org_id();
  v_email    text   := lower(trim(p_email));
  v_user     bigint;
  v_existent public.utilizator%rowtype;
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
  if v_email is null or v_email = '' then
    raise exception 'Emailul este obligatoriu.';
  end if;

  select * into v_existent
    from public.utilizator
   where organizatie_id = v_org and lower(email) = v_email;

  if found then
    if v_existent.auth_user_id is not null or v_existent.status = 'ACTIV' then
      raise exception 'Exista deja un cont activ cu emailul % in organizatie.', v_email;
    end if;
    -- Invitatie existenta, nefinalizata: o refolosim.
    update public.utilizator
       set rol = p_rol, nume_prenume = p_nume_prenume, status = 'INVITAT'
     where id = v_existent.id;
    v_user := v_existent.id;
  else
    insert into public.utilizator (organizatie_id, nume_prenume, email, rol, status)
    values (v_org, p_nume_prenume, v_email, p_rol, 'INVITAT')
    returning id into v_user;
  end if;

  -- Profil asociat (idempotent pe utilizator_id).
  if p_rol = 'PROFESOR' then
    insert into public.profesor (organizatie_id, utilizator_id, nume_prenume)
    values (v_org, v_user, p_nume_prenume)
    on conflict (utilizator_id) do update set nume_prenume = excluded.nume_prenume;
  elsif p_rol = 'TUTOR' then
    insert into public.tutor (organizatie_id, utilizator_id, nume_prenume, email)
    values (v_org, v_user, p_nume_prenume, v_email)
    on conflict (utilizator_id) do update
      set nume_prenume = excluded.nume_prenume, email = excluded.email;
  elsif p_rol = 'STUDENT' then
    insert into public.student (organizatie_id, utilizator_id, nume_prenume, email)
    values (v_org, v_user, p_nume_prenume, v_email)
    on conflict (utilizator_id) do update
      set nume_prenume = excluded.nume_prenume, email = excluded.email;
  end if;

  return v_user;
end;
$$;

grant execute on function public.invite_utilizator(text, text, text) to authenticated;
