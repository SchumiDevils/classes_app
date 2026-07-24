// Strat de acces la date (Faza 3). Toate interogarile sunt izolate per tenant
// automat prin RLS - nu trebuie sa trimiti niciodata organizatie_id manual.

import { supabase } from '@/lib/supabase';
import type {
  ContractRow,
  DatorieRow,
  GrupaRow,
  LectieDetaliatRow,
  LectieRow,
  OrarRow,
  OrgDashboardRow,
  PlataRow,
  PrezentaRow,
  ProfesorRow,
  Rol,
  StatusLectie,
  StudentDashboardRow,
  StudentRow,
  TipContractRow,
  TutorRow,
  Ziua,
} from '@/lib/database.types';

// ---------- Dashboard ---------------------------------------------------------
export async function getOrgDashboard(): Promise<OrgDashboardRow | null> {
  const { data, error } = await supabase.from('v_org_dashboard').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStudentDashboards(): Promise<StudentDashboardRow[]> {
  const { data, error } = await supabase
    .from('v_student_dashboard')
    .select('*')
    .order('nume_prenume');
  if (error) throw error;
  return data ?? [];
}

// ---------- Elevi -------------------------------------------------------------
export type ElevListItem = StudentRow & { balanta: number; ore_realizate: number; ore_achitate: number };

export async function listEleviCuBalanta(): Promise<ElevListItem[]> {
  const [studenti, dash] = await Promise.all([listStudenti(), getStudentDashboards()]);
  const map = new Map(dash.map((d) => [d.student_id, d]));
  return studenti.map((s) => {
    const d = map.get(s.id);
    return {
      ...s,
      balanta: d?.balanta ?? 0,
      ore_realizate: d?.ore_realizate ?? 0,
      ore_achitate: d?.ore_achitate ?? 0,
    };
  });
}

export async function listStudenti(): Promise<StudentRow[]> {
  const { data, error } = await supabase.from('student').select('*').order('nume_prenume');
  if (error) throw error;
  return data ?? [];
}

export async function getStudent(id: number): Promise<StudentRow | null> {
  const { data, error } = await supabase.from('student').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createStudent(input: {
  nume_prenume: string;
  clasa?: string | null;
  email?: string | null;
  telefon?: string | null;
  tutor_id?: number | null;
  id_sistem?: string | null;
}): Promise<StudentRow> {
  const { data, error } = await supabase
    .from('student')
    .insert({
      nume_prenume: input.nume_prenume,
      clasa: input.clasa ?? null,
      email: input.email ?? null,
      telefon: input.telefon ?? null,
      tutor_id: input.tutor_id ?? null,
      id_sistem: input.id_sistem ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudent(id: number, patch: Partial<StudentRow>): Promise<void> {
  const { error } = await supabase.from('student').update(patch).eq('id', id);
  if (error) throw error;
}

export async function getStudentDashboard(id: number): Promise<StudentDashboardRow | null> {
  const { data, error } = await supabase
    .from('v_student_dashboard')
    .select('*')
    .eq('student_id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Tutori ------------------------------------------------------------
export async function listTutori(): Promise<TutorRow[]> {
  const { data, error } = await supabase.from('tutor').select('*').order('nume_prenume');
  if (error) throw error;
  return data ?? [];
}

export async function getTutor(id: number): Promise<TutorRow | null> {
  const { data, error } = await supabase.from('tutor').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTutor(input: {
  nume_prenume: string;
  email?: string | null;
  telefon?: string | null;
}): Promise<TutorRow> {
  const { data, error } = await supabase
    .from('tutor')
    .insert({ nume_prenume: input.nume_prenume, email: input.email ?? null, telefon: input.telefon ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ---------- Grupe / Profesori / Tip contract ---------------------------------
export async function listGrupe(): Promise<GrupaRow[]> {
  const { data, error } = await supabase.from('grupa').select('*').order('denumire');
  if (error) throw error;
  return data ?? [];
}

export async function getGrupa(id: number): Promise<GrupaRow | null> {
  const { data, error } = await supabase.from('grupa').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGrupa(input: {
  denumire: string;
  profesor_id?: number | null;
  tip_contract_id?: number | null;
}): Promise<GrupaRow> {
  const { data, error } = await supabase
    .from('grupa')
    .insert({
      denumire: input.denumire,
      profesor_id: input.profesor_id ?? null,
      tip_contract_id: input.tip_contract_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateGrupa(id: number, patch: Partial<GrupaRow>): Promise<void> {
  const { error } = await supabase.from('grupa').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteGrupa(id: number): Promise<void> {
  const { error } = await supabase.from('grupa').delete().eq('id', id);
  if (error) throw error;
}

export async function listProfesori(): Promise<ProfesorRow[]> {
  const { data, error } = await supabase.from('profesor').select('*').order('nume_prenume');
  if (error) throw error;
  return data ?? [];
}

export async function listTipuriContract(): Promise<TipContractRow[]> {
  const { data, error } = await supabase.from('tip_contract').select('*').order('cod');
  if (error) throw error;
  return data ?? [];
}

// ---------- Orar --------------------------------------------------------------
export async function getOrarGrupa(grupaId: number): Promise<OrarRow[]> {
  const { data, error } = await supabase
    .from('orar')
    .select('*')
    .eq('grupa_id', grupaId)
    .order('ora');
  if (error) throw error;
  return data ?? [];
}

export async function createOrar(input: {
  grupa_id: number;
  ziua: Ziua;
  ora: string;
}): Promise<OrarRow> {
  const { data, error } = await supabase
    .from('orar')
    .insert({ grupa_id: input.grupa_id, ziua: input.ziua, ora: input.ora })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOrar(id: number): Promise<void> {
  const { error } = await supabase.from('orar').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Contract ----------------------------------------------------------
export async function getContractStudent(studentId: number): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from('contract')
    .select('*')
    .eq('student_id', studentId)
    .order('data_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertContract(input: {
  id?: number;
  student_id: number;
  grupa_id?: number | null;
  pret_standard: number;
  reducere_aplicata: number;
}): Promise<void> {
  if (input.id) {
    const { error } = await supabase
      .from('contract')
      .update({
        grupa_id: input.grupa_id ?? null,
        pret_standard: input.pret_standard,
        reducere_aplicata: input.reducere_aplicata,
      })
      .eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('contract').insert({
      student_id: input.student_id,
      grupa_id: input.grupa_id ?? null,
      pret_standard: input.pret_standard,
      reducere_aplicata: input.reducere_aplicata,
    });
    if (error) throw error;
  }
}

// ---------- Lectii ------------------------------------------------------------
export async function listLectii(): Promise<LectieDetaliatRow[]> {
  const { data, error } = await supabase
    .from('v_lectie_detaliat')
    .select('*')
    .order('data', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLectie(id: number): Promise<LectieRow | null> {
  const { data, error } = await supabase.from('lectie').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listLectiiGrupa(grupaId: number): Promise<LectieRow[]> {
  const { data, error } = await supabase
    .from('lectie')
    .select('*')
    .eq('grupa_id', grupaId)
    .order('nr', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createLectie(input: {
  grupa_id: number;
  profesor_id?: number | null;
  nr?: number | null;
  data?: string | null;
  subiect?: string | null;
  status?: StatusLectie;
  recomandari?: string | null;
}): Promise<LectieRow> {
  const { data, error } = await supabase
    .from('lectie')
    .insert({
      grupa_id: input.grupa_id,
      profesor_id: input.profesor_id ?? null,
      nr: input.nr ?? null,
      data: input.data ?? null,
      subiect: input.subiect ?? null,
      status: input.status ?? 'PLANIFICATA',
      recomandari: input.recomandari ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateLectie(id: number, patch: Partial<LectieRow>): Promise<void> {
  const { error } = await supabase.from('lectie').update(patch).eq('id', id);
  if (error) throw error;
}

export async function genereazaLectii(input: {
  grupaId: number;
  dataStart: string;
  dataSfarsit: string;
  profesorId?: number | null;
}): Promise<number> {
  const { data, error } = await supabase.rpc('genereaza_lectii', {
    p_grupa_id: input.grupaId,
    p_data_start: input.dataStart,
    p_data_sfarsit: input.dataSfarsit,
    p_profesor_id: input.profesorId ?? null,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

// ---------- Prezenta ----------------------------------------------------------
export type PrezentaElev = { student_id: number; nume_prenume: string; prezent: boolean; prezenta_id: number | null };

export async function getPrezentaLectie(lectieId: number, grupaId: number): Promise<PrezentaElev[]> {
  const contracte = await supabase.from('contract').select('student_id').eq('grupa_id', grupaId);
  if (contracte.error) throw contracte.error;

  const ids = Array.from(new Set((contracte.data ?? []).map((c) => c.student_id)));
  if (ids.length === 0) return [];

  const [studentiRes, prezenteRes] = await Promise.all([
    supabase.from('student').select('id, nume_prenume').in('id', ids),
    supabase.from('prezenta').select('*').eq('lectie_id', lectieId),
  ]);
  if (studentiRes.error) throw studentiRes.error;
  if (prezenteRes.error) throw prezenteRes.error;

  const prezMap = new Map((prezenteRes.data ?? []).map((p) => [p.student_id, p]));
  return (studentiRes.data ?? [])
    .map((st) => {
      const p = prezMap.get(st.id);
      return {
        student_id: st.id,
        nume_prenume: st.nume_prenume,
        prezent: p?.prezent ?? false,
        prezenta_id: p?.id ?? null,
      };
    })
    .sort((a, b) => a.nume_prenume.localeCompare(b.nume_prenume));
}

export async function setPrezenta(input: {
  lectie_id: number;
  student_id: number;
  prezent: boolean;
  prezenta_id?: number | null;
}): Promise<void> {
  if (input.prezenta_id) {
    const { error } = await supabase
      .from('prezenta')
      .update({ prezent: input.prezent })
      .eq('id', input.prezenta_id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('prezenta')
      .insert({ lectie_id: input.lectie_id, student_id: input.student_id, prezent: input.prezent });
    if (error) throw error;
  }
}

// ---------- Plati -------------------------------------------------------------
export async function listPlati(): Promise<PlataRow[]> {
  const { data, error } = await supabase
    .from('plata')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPlatiStudent(studentId: number): Promise<PlataRow[]> {
  const { data, error } = await supabase
    .from('plata')
    .select('*')
    .eq('student_id', studentId)
    .order('data', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function adaugaPlata(input: {
  studentId: number;
  contractId?: number | null;
  data: string;
  sesiuni: number;
  suma: number;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.from('plata').insert({
    student_id: input.studentId,
    contract_id: input.contractId ?? null,
    data: input.data,
    sesiuni: input.sesiuni,
    suma: input.suma,
    note: input.note ?? null,
  });
  if (error) throw error;
}

export async function stergePlata(id: number): Promise<void> {
  const { error } = await supabase.from('plata').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Datorii (note de plata) -------------------------------------------
export async function listDatorii(): Promise<DatorieRow[]> {
  const { data, error } = await supabase
    .from('datorie')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listDatoriiStudent(studentId: number): Promise<DatorieRow[]> {
  const { data, error } = await supabase
    .from('datorie')
    .select('*')
    .eq('student_id', studentId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function genereazaDatorii(): Promise<number> {
  const { data, error } = await supabase.rpc('genereaza_datorii');
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export async function genereazaDatorieStudent(studentId: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('genereaza_datorie', { p_student_id: studentId });
  if (error) throw error;
  return data as number | null;
}

export async function achitaDatorie(datorieId: number): Promise<number> {
  const { data, error } = await supabase.rpc('achita_datorie', { p_datorie_id: datorieId });
  if (error) throw error;
  return data as number;
}

export async function anuleazaDatorie(datorieId: number): Promise<void> {
  const { error } = await supabase.rpc('anuleaza_datorie', { p_datorie_id: datorieId });
  if (error) throw error;
}

// ---------- Admin / demo ------------------------------------------------------
export async function inviteUtilizator(input: {
  email: string;
  rol: Rol;
  numePrenume: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('invite_utilizator', {
    p_email: input.email,
    p_rol: input.rol,
    p_nume_prenume: input.numePrenume,
  });
  if (error) throw error;
  return data as number;
}

export async function seedDemoData(): Promise<string> {
  const { data, error } = await supabase.rpc('seed_demo_data');
  if (error) throw error;
  return data as string;
}

export async function stergeDateDemo(): Promise<string> {
  const { data, error } = await supabase.rpc('sterge_date_demo');
  if (error) throw error;
  return data as string;
}
