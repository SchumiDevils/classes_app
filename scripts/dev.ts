/* eslint-disable no-console */
/**
 * CLI de dezvoltare pentru testare rapida pe Supabase (remote).
 *
 * Foloseste cheia service_role pentru a crea conturi DEJA CONFIRMATE (fara email
 * de confirmare) si ruleaza fluxurile reale (onboarding, invite, seed) ca un
 * utilizator autentificat, exact ca aplicatia.
 *
 * Configurare (o singura data):
 *   1. In Supabase Dashboard: Project Settings > API > `service_role` secret.
 *   2. Creeaza fisierul `.env.local` (este in .gitignore) cu:
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...    (cheia service_role)
 *   (URL-ul si cheia publishable se citesc din `.env`.)
 *
 * Utilizare:
 *   npm run cli -- <comanda> [argumente]
 *
 * Comenzi:
 *   bootstrap                                   Scenariu complet: owner + date demo + tutore, gata de login.
 *   owner <email> <pass> <"Org"> <COMPANIE|INDEPENDENT> <"Nume"> [specializare]
 *   create-user <email> <pass> [nume]          Cont auth confirmat (leaga o invitatie daca exista).
 *   invite <ownerEmail> <ownerPass> <email> <ADMIN|PROFESOR|TUTOR|STUDENT> <"Nume">
 *   accept <email> <pass>                       Activeaza o invitatie (creeaza contul confirmat).
 *   seed <ownerEmail> <ownerPass>               Incarca datele demo in organizatia userului.
 *   wipe <ownerEmail> <ownerPass>               Sterge datele de test din organizatie.
 *   list-users                                  Listeaza conturile auth.
 *   delete-user <email>                         Sterge un cont auth (dupa email).
 */
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database, Rol, TipOrganizatie } from '../src/lib/database.types';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(msg: string): never {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
}

if (!URL || !ANON) die('Lipsesc EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY din .env');
if (!SERVICE) {
  die(
    'Lipseste SUPABASE_SERVICE_ROLE_KEY. Adauga-l in .env.local (Project Settings > API > service_role).',
  );
}

type DB = SupabaseClient<Database>;

const admin: DB = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ok = (msg: string) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const info = (msg: string) => console.log(`\x1b[36m•\x1b[0m ${msg}`);

function errMsg(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    return [o.message, o.details, o.hint].filter(Boolean).join(' · ') || String(e);
  }
  return String(e);
}

/** Creeaza (sau refoloseste) un cont auth confirmat si intoarce id-ul lui. */
async function createConfirmedUser(email: string, password: string, nume?: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: nume ? { nume_prenume: nume } : undefined,
  });
  if (error) {
    // Daca exista deja, il gasim si ii resetam parola ca sa ne putem loga.
    if (/already been registered|already exists/i.test(error.message)) {
      const existing = await findUserByEmail(email);
      if (existing) {
        await admin.auth.admin.updateUserById(existing, { password, email_confirm: true });
        info(`Cont existent refolosit: ${email}`);
        return existing;
      }
    }
    throw error;
  }
  return data.user.id;
}

async function findUserByEmail(email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

/** Client autentificat ca un utilizator real (pentru RPC-uri care folosesc auth.uid()). */
async function asUser(email: string, password: string): Promise<DB> {
  const c = createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

// ---------- Comenzi -----------------------------------------------------------
async function cmdOwner(args: string[]) {
  const [email, pass, org, tip, nume, specializare] = args;
  if (!email || !pass || !org || !tip || !nume) {
    die('owner <email> <pass> <"Org"> <COMPANIE|INDEPENDENT> <"Nume"> [specializare]');
  }
  await createConfirmedUser(email, pass, nume);
  ok(`Cont owner confirmat: ${email}`);
  const c = await asUser(email, pass);
  const { error } = await c.rpc('onboard_organizatie', {
    p_nume_organizatie: org,
    p_tip: tip as TipOrganizatie,
    p_nume_prenume: nume,
    p_specializare: specializare ?? null,
  });
  if (error) throw error;
  ok(`Organizatie creata: "${org}" (${tip})`);
}

async function cmdCreateUser(args: string[]) {
  const [email, pass, nume] = args;
  if (!email || !pass) die('create-user <email> <pass> [nume]');
  await createConfirmedUser(email, pass, nume);
  ok(`Cont confirmat: ${email} (o invitatie cu acest email s-a activat automat, daca exista)`);
}

async function cmdInvite(args: string[]) {
  const [ownerEmail, ownerPass, email, rol, nume] = args;
  if (!ownerEmail || !ownerPass || !email || !rol || !nume) {
    die('invite <ownerEmail> <ownerPass> <email> <ADMIN|PROFESOR|TUTOR|STUDENT> <"Nume">');
  }
  const c = await asUser(ownerEmail, ownerPass);
  const { error } = await c.rpc('invite_utilizator', {
    p_email: email,
    p_rol: rol as Rol,
    p_nume_prenume: nume,
  });
  if (error) throw error;
  ok(`Invitatie creata pentru ${email} ca ${rol}`);
}

async function cmdAccept(args: string[]) {
  const [email, pass] = args;
  if (!email || !pass) die('accept <email> <pass>');
  await createConfirmedUser(email, pass);
  ok(`Invitatie activata: ${email} se poate loga acum cu parola data.`);
}

async function cmdSeed(args: string[]) {
  const [email, pass] = args;
  if (!email || !pass) die('seed <ownerEmail> <ownerPass>');
  const c = await asUser(email, pass);
  const { data, error } = await c.rpc('seed_demo_data');
  if (error) throw error;
  ok(String(data));
}

async function cmdWipe(args: string[]) {
  const [email, pass] = args;
  if (!email || !pass) die('wipe <ownerEmail> <ownerPass>');
  const c = await asUser(email, pass);
  const { data, error } = await c.rpc('sterge_date_demo');
  if (error) throw error;
  ok(String(data));
}

async function cmdListUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  if (data.users.length === 0) return info('Niciun cont auth.');
  for (const u of data.users) {
    console.log(`  ${u.email}   ${u.email_confirmed_at ? 'confirmat' : 'NECONFIRMAT'}   ${u.id}`);
  }
}

async function cmdDeleteUser(args: string[]) {
  const [email] = args;
  if (!email) die('delete-user <email>');
  const id = await findUserByEmail(email);
  if (!id) die(`Nu am gasit contul ${email}`);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
  ok(`Cont sters: ${email}`);
}

async function cmdBootstrap() {
  const ownerEmail = 'owner@test.dev';
  const ownerPass = 'Parola123!';
  const tutorEmail = 'tutore@test.dev';
  const tutorPass = 'Parola123!';

  info('1/4 · creez owner + organizatie…');
  try {
    await cmdOwner([ownerEmail, ownerPass, 'Centrul Demo', 'INDEPENDENT', 'Ion Owner', 'Matematica']);
  } catch (e) {
    // daca organizatia exista deja, continuam
    info(`(owner) ${errMsg(e)}`);
  }

  info('2/4 · incarc datele demo…');
  try {
    await cmdSeed([ownerEmail, ownerPass]);
  } catch (e) {
    info(`(seed) ${errMsg(e)}`);
  }

  info('3/4 · invit un tutore…');
  try {
    await cmdInvite([ownerEmail, ownerPass, tutorEmail, 'TUTOR', 'Elena Tutore']);
  } catch (e) {
    info(`(invite) ${errMsg(e)}`);
  }

  info('4/4 · activez contul tutorelui…');
  try {
    await cmdAccept([tutorEmail, tutorPass]);
  } catch (e) {
    info(`(accept) ${errMsg(e)}`);
  }

  console.log('\n\x1b[1mConturi de test gata:\x1b[0m');
  console.log(`  OWNER  → ${ownerEmail} / ${ownerPass}`);
  console.log(`  TUTORE → ${tutorEmail} / ${tutorPass}`);
}

const [, , command, ...args] = process.argv;

const commands: Record<string, (a: string[]) => Promise<void>> = {
  owner: cmdOwner,
  'create-user': cmdCreateUser,
  invite: cmdInvite,
  accept: cmdAccept,
  seed: cmdSeed,
  wipe: cmdWipe,
  'list-users': () => cmdListUsers(),
  'delete-user': cmdDeleteUser,
  bootstrap: () => cmdBootstrap(),
};

async function main() {
  const fn = command ? commands[command] : undefined;
  if (!fn) {
    console.log('Comenzi disponibile:');
    console.log('  bootstrap | owner | create-user | invite | accept | seed | wipe | list-users | delete-user');
    console.log('\nExemplu rapid:  npm run cli -- bootstrap');
    process.exit(command ? 1 : 0);
  }
  try {
    await fn(args);
  } catch (e) {
    die(errMsg(e));
  }
}

main();
