// =============================================================================
// Tipuri TypeScript pentru schema Supabase (scrise manual).
// Dupa ce migrarile sunt aplicate pe remote poti regenera automat cu:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts
// =============================================================================

// ---- Enum-uri de domeniu -----------------------------------------------------
export type TipOrganizatie = 'COMPANIE' | 'INDEPENDENT';
export type StatusOrganizatie = 'ACTIV' | 'SUSPENDAT' | 'INACTIV';
export type CicluFacturare = 'LUNAR' | 'ANUAL';
export type StatusAbonament = 'TRIAL' | 'ACTIV' | 'EXPIRAT' | 'ANULAT';
export type StatusFactura = 'PLATITA' | 'NEACHITATA' | 'ANULATA';
export type Rol = 'OWNER' | 'ADMIN' | 'PROFESOR' | 'TUTOR' | 'STUDENT';
export type StatusUtilizator = 'ACTIV' | 'INVITAT' | 'SUSPENDAT';
export type StatusStudent = 'ACTIV' | 'INACTIV' | 'ABSOLVIT';
export type StatusContract = 'ACTIV' | 'FINALIZAT' | 'ANULAT';
export type StatusLectie = 'PLANIFICATA' | 'REALIZATA' | 'ANULATA';
export type StatusDatorie = 'NEACHITATA' | 'ACHITATA' | 'ANULATA';
export type Ziua =
  | 'LUNI' | 'MARTI' | 'MIERCURI' | 'JOI' | 'VINERI' | 'SAMBATA' | 'DUMINICA';

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// ---- Randuri (Row) -----------------------------------------------------------
// NOTA: folosim `type` (nu `interface`) intentionat. Interfetele nu sunt
// atribuibile la Record<string, unknown>, ceea ce ar face ca supabase-js sa
// rezolve schema la `never`.
export type PlanRow = {
  id: number;
  nume: string;
  pret_lunar: number;
  pret_anual: number;
  max_profesori: number | null;
  max_elevi: number | null;
  functii: Json;
  stripe_price_lunar: string | null;
  stripe_price_anual: string | null;
  activ: boolean;
  created_at: string;
}

export type OrganizatieRow = {
  id: number;
  nume: string;
  tip: TipOrganizatie;
  email_contact: string | null;
  telefon: string | null;
  data_inregistrare: string;
  status: StatusOrganizatie;
  created_at: string;
  updated_at: string;
}

export type AbonamentRow = {
  id: number;
  organizatie_id: number;
  plan_id: number;
  data_start: string;
  data_expirare: string | null;
  ciclu_facturare: CicluFacturare;
  status: StatusAbonament;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export type FacturaSaasRow = {
  id: number;
  abonament_id: number;
  data: string;
  suma: number;
  status_plata: StatusFactura;
  stripe_invoice_id: string | null;
  created_at: string;
}

export type UtilizatorRow = {
  id: number;
  organizatie_id: number;
  auth_user_id: string | null;
  nume_prenume: string;
  email: string;
  rol: Rol;
  status: StatusUtilizator;
  created_at: string;
  updated_at: string;
}

export type ProfesorRow = {
  id: number;
  organizatie_id: number;
  utilizator_id: number | null;
  nume_prenume: string;
  specializare: string | null;
  created_at: string;
  updated_at: string;
}

export type TutorRow = {
  id: number;
  organizatie_id: number;
  utilizator_id: number | null;
  nume_prenume: string;
  email: string | null;
  telefon: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentRow = {
  id: number;
  organizatie_id: number;
  utilizator_id: number | null;
  tutor_id: number | null;
  id_recomandare: number | null;
  id_sistem: string | null;
  id_vizual: string | null;
  clasa: string | null;
  nume_prenume: string;
  email: string | null;
  telefon: string | null;
  status: StatusStudent;
  created_at: string;
  updated_at: string;
}

export type TipContractRow = {
  id: number;
  organizatie_id: number;
  cod: string;
  denumire: string;
  pret_standard: number;
  ore_minime: number;
  reducere_loialitate: number;
  reducere_referral: number;
  created_at: string;
  updated_at: string;
}

export type GrupaRow = {
  id: number;
  organizatie_id: number;
  profesor_id: number | null;
  tip_contract_id: number | null;
  denumire: string;
  created_at: string;
  updated_at: string;
}

export type ContractRow = {
  id: number;
  organizatie_id: number;
  student_id: number;
  grupa_id: number | null;
  data_start: string;
  pret_standard: number;
  reducere_aplicata: number;
  pret_sesiune: number; // generat
  status: StatusContract;
  created_at: string;
  updated_at: string;
}

export type OrarRow = {
  id: number;
  organizatie_id: number;
  grupa_id: number;
  ziua: Ziua;
  ora: string;
  created_at: string;
  updated_at: string;
}

export type LectieRow = {
  id: number;
  organizatie_id: number;
  grupa_id: number;
  profesor_id: number | null;
  nr: number | null;
  data: string | null;
  subiect: string | null;
  status: StatusLectie;
  recomandari: string | null;
  created_at: string;
  updated_at: string;
}

export type PrezentaRow = {
  id: number;
  organizatie_id: number;
  lectie_id: number;
  student_id: number;
  prezent: boolean;
  created_at: string;
  updated_at: string;
}

export type PlataRow = {
  id: number;
  organizatie_id: number;
  contract_id: number | null;
  student_id: number;
  data: string;
  sesiuni: number;
  suma: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type DatorieRow = {
  id: number;
  organizatie_id: number;
  student_id: number;
  contract_id: number | null;
  data: string;
  scadenta: string | null;
  sesiuni: number;
  suma: number;
  status: StatusDatorie;
  plata_id: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ---- View-uri ----------------------------------------------------------------
export type StudentDashboardRow = {
  student_id: number;
  organizatie_id: number;
  nume_prenume: string;
  ore_realizate: number;
  ore_achitate: number;
  balanta: number;
  venit: number;
}

export type OrgDashboardRow = {
  organizatie_id: number;
  total_ore_realizate: number;
  total_ore_achitate: number;
  balanta_totala: number;
  venit_total: number;
  elevi_cu_restanta: number;
}

export type LectieDetaliatRow = {
  id: number;
  organizatie_id: number;
  grupa_id: number;
  grupa: string | null;
  profesor_id: number | null;
  nr: number | null;
  data: string | null;
  subiect: string | null;
  status: StatusLectie;
  recomandari: string | null;
  nr_prezenti: number;
  nr_total: number;
}

export type ProfilCurent = {
  utilizator_id: number;
  organizatie_id: number;
  nume_prenume: string;
  email: string;
  rol: Rol;
  status: StatusUtilizator;
  organizatie: string;
  tip_organizatie: TipOrganizatie;
}

// ---- Helper pentru definitiile de tabela/view --------------------------------
type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type ViewDef<Row> = { Row: Row; Relationships: [] };

// ---- Tipul Database (consumat de createClient<Database>) ---------------------
export type Database = {
  public: {
    Tables: {
      plan: TableDef<PlanRow>;
      organizatie: TableDef<OrganizatieRow>;
      abonament: TableDef<AbonamentRow>;
      factura_saas: TableDef<FacturaSaasRow>;
      utilizator: TableDef<UtilizatorRow>;
      profesor: TableDef<ProfesorRow>;
      tutor: TableDef<TutorRow>;
      student: TableDef<StudentRow>;
      tip_contract: TableDef<TipContractRow>;
      grupa: TableDef<GrupaRow>;
      contract: TableDef<ContractRow>;
      orar: TableDef<OrarRow>;
      lectie: TableDef<LectieRow>;
      prezenta: TableDef<PrezentaRow>;
      plata: TableDef<PlataRow>;
      datorie: TableDef<DatorieRow>;
    };
    Views: {
      v_student_dashboard: ViewDef<StudentDashboardRow>;
      v_org_dashboard: ViewDef<OrgDashboardRow>;
      v_lectie_detaliat: ViewDef<LectieDetaliatRow>;
    };
    Functions: {
      onboard_organizatie: {
        Args: {
          p_nume_organizatie: string;
          p_tip: TipOrganizatie;
          p_nume_prenume: string;
          p_specializare?: string | null;
        };
        Returns: number;
      };
      invite_utilizator: {
        Args: { p_email: string; p_rol: Rol; p_nume_prenume: string };
        Returns: number;
      };
      get_profil_curent: {
        Args: Record<string, never>;
        Returns: ProfilCurent[];
      };
      seed_demo_data: {
        Args: Record<string, never>;
        Returns: string;
      };
      sterge_date_demo: {
        Args: Record<string, never>;
        Returns: string;
      };
      genereaza_datorii: {
        Args: Record<string, never>;
        Returns: number;
      };
      genereaza_datorie: {
        Args: { p_student_id: number };
        Returns: number | null;
      };
      achita_datorie: {
        Args: { p_datorie_id: number };
        Returns: number;
      };
      anuleaza_datorie: {
        Args: { p_datorie_id: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
