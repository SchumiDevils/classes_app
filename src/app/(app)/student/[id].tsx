import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  Badge,
  Button,
  ChipSelect,
  EmptyState,
  Field,
  Metric,
  Row,
  Section,
  Segmented,
  Sheet,
  colors,
  lei,
  procent,
  sectionColors,
  statusDatorieColor,
  statusLectieColor,
} from '@/components/ui';
import { esteTutore as esteTutoreRol, ROLURI_ADMIN, useSession } from '@/lib/ctx';
import {
  achitaDatorie,
  adaugaPlata,
  getContractStudent,
  getGrupa,
  getOrarGrupa,
  getStudent,
  getStudentDashboard,
  getTutor,
  listDatoriiStudent,
  listGrupe,
  listLectiiGrupa,
  listPlatiStudent,
  listTipuriContract,
  updateStudent,
  upsertContract,
} from '@/lib/queries';
import type {
  ContractRow,
  DatorieRow,
  GrupaRow,
  LectieRow,
  OrarRow,
  PlataRow,
  StudentDashboardRow,
  StudentRow,
  TipContractRow,
  TutorRow,
} from '@/lib/database.types';

const ZIUA_LABEL: Record<string, string> = {
  LUNI: 'Luni', MARTI: 'Marți', MIERCURI: 'Miercuri', JOI: 'Joi',
  VINERI: 'Vineri', SAMBATA: 'Sâmbătă', DUMINICA: 'Duminică',
};

type Sectiune = 'admin' | 'financiar' | 'lectii' | 'achitari';

export default function FisaElev() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const { profile } = useSession();
  const esteAdmin = !!profile && ROLURI_ADMIN.includes(profile.rol);
  const poateAchita = esteAdmin || esteTutoreRol(profile?.rol);

  const [loading, setLoading] = useState(true);
  const [sectiune, setSectiune] = useState<Sectiune>('admin');

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [tutor, setTutor] = useState<TutorRow | null>(null);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [grupa, setGrupa] = useState<GrupaRow | null>(null);
  const [orar, setOrar] = useState<OrarRow[]>([]);
  const [tipuri, setTipuri] = useState<TipContractRow[]>([]);
  const [grupe, setGrupe] = useState<GrupaRow[]>([]);
  const [dash, setDash] = useState<StudentDashboardRow | null>(null);
  const [lectii, setLectii] = useState<LectieRow[]>([]);
  const [plati, setPlati] = useState<PlataRow[]>([]);
  const [datorii, setDatorii] = useState<DatorieRow[]>([]);

  const incarca = useCallback(async () => {
    const [st, ct, tc, gr, ds, pl, dt] = await Promise.all([
      getStudent(studentId),
      getContractStudent(studentId),
      listTipuriContract(),
      listGrupe(),
      getStudentDashboard(studentId),
      listPlatiStudent(studentId),
      listDatoriiStudent(studentId),
    ]);
    setStudent(st);
    setContract(ct);
    setTipuri(tc);
    setGrupe(gr);
    setDash(ds);
    setPlati(pl);
    setDatorii(dt);
    setTutor(st?.tutor_id ? await getTutor(st.tutor_id) : null);

    const grupaId = ct?.grupa_id ?? null;
    if (grupaId) {
      const [g, o, l] = await Promise.all([
        getGrupa(grupaId),
        getOrarGrupa(grupaId),
        listLectiiGrupa(grupaId),
      ]);
      setGrupa(g);
      setOrar(o);
      setLectii(l);
    } else {
      setGrupa(null);
      setOrar([]);
      setLectii([]);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          await incarca();
        } catch (e) {
          Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut incarca fisa.');
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [incarca]),
  );

  const tipContract = useMemo(
    () => tipuri.find((t) => t.id === grupa?.tip_contract_id) ?? null,
    [tipuri, grupa],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={styles.center}>
        <EmptyState text="Elevul nu a fost găsit." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: student.nume_prenume }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        <Segmented<Sectiune>
          value={sectiune}
          onChange={setSectiune}
          options={[
            { value: 'admin', label: 'Administrativ' },
            { value: 'financiar', label: 'Financiar' },
            { value: 'lectii', label: 'Lecții' },
            { value: 'achitari', label: 'Achitări' },
          ]}
        />

        {sectiune === 'admin' ? (
          <AdminSectiune
            student={student}
            tutor={tutor}
            contract={contract}
            grupa={grupa}
            orar={orar}
            tipContract={tipContract}
            grupe={grupe}
            esteAdmin={esteAdmin}
            onReload={incarca}
          />
        ) : sectiune === 'financiar' ? (
          <FinanciarSectiune dash={dash} />
        ) : sectiune === 'lectii' ? (
          <LectiiSectiune lectii={lectii} grupa={grupa} />
        ) : (
          <AchitariSectiune
            plati={plati}
            datorii={datorii}
            contractId={contract?.id ?? null}
            studentId={studentId}
            esteAdmin={esteAdmin}
            poateAchita={poateAchita}
            onReload={incarca}
          />
        )}
      </ScrollView>
    </>
  );
}

// ---------- ADMINISTRATIV -----------------------------------------------------
function AdminSectiune({
  student,
  tutor,
  contract,
  grupa,
  orar,
  tipContract,
  grupe,
  esteAdmin,
  onReload,
}: {
  student: StudentRow;
  tutor: TutorRow | null;
  contract: ContractRow | null;
  grupa: GrupaRow | null;
  orar: OrarRow[];
  tipContract: TipContractRow | null;
  grupe: GrupaRow[];
  esteAdmin: boolean;
  onReload: () => Promise<void>;
}) {
  const [editElev, setEditElev] = useState(false);
  const [editConfig, setEditConfig] = useState(false);

  return (
    <View style={{ gap: 14 }}>
      <Section title="DATE ELEV" color={sectionColors.elev}>
        <Row label="Identificator" value={student.id_vizual ?? student.id_sistem ?? '—'} />
        <Row label="Nume Prenume" value={student.nume_prenume} />
        <Row label="Clasa" value={student.clasa ?? '—'} />
        <Row label="Telefon" value={student.telefon ?? '—'} />
        <Row label="Email" value={student.email ?? '—'} />
      </Section>
      {esteAdmin ? (
        <Button variant="ghost" label="Editează datele elevului" onPress={() => setEditElev(true)} />
      ) : null}

      <Section title="DATE TUTORE" color={sectionColors.tutore}>
        {tutor ? (
          <>
            <Row label="Nume Prenume" value={tutor.nume_prenume} />
            <Row label="Telefon" value={tutor.telefon ?? '—'} />
            <Row label="Email" value={tutor.email ?? '—'} />
          </>
        ) : (
          <Row label="Tutore" value="Niciunul" />
        )}
      </Section>

      <Section title="ORAR SĂPTĂMÂNAL" color={sectionColors.orar}>
        {grupa ? <Row label="Grupă" value={grupa.denumire} /> : null}
        {orar.length === 0 ? (
          <Row label="Program" value="Nedefinit" />
        ) : (
          orar.map((o, i) => (
            <Row key={o.id} label={`Ziua ${i + 1}`} value={`${ZIUA_LABEL[o.ziua]} · ${o.ora.slice(0, 5)}`} />
          ))
        )}
      </Section>

      <Section title="CONFIGURARE FINANCIARĂ" color={sectionColors.financiar}>
        <Row label="Tip Abonament" value={tipContract?.denumire ?? '—'} />
        <Row label="Preț Standard" value={contract ? lei(contract.pret_standard) : '—'} />
        <Row label="Reducere Aplicată" value={contract ? procent(contract.reducere_aplicata) : '—'} />
        <Row label="Preț Sesiune" value={contract ? lei(contract.pret_sesiune) : '—'} strong />
      </Section>
      {esteAdmin ? (
        <Button variant="ghost" label="Editează configurarea financiară" onPress={() => setEditConfig(true)} />
      ) : null}

      <EditElevSheet
        visible={editElev}
        student={student}
        onClose={() => setEditElev(false)}
        onSaved={async () => {
          setEditElev(false);
          await onReload();
        }}
      />
      <EditConfigSheet
        visible={editConfig}
        student={student}
        contract={contract}
        grupe={grupe}
        onClose={() => setEditConfig(false)}
        onSaved={async () => {
          setEditConfig(false);
          await onReload();
        }}
      />
    </View>
  );
}

function EditElevSheet({
  visible,
  student,
  onClose,
  onSaved,
}: {
  visible: boolean;
  student: StudentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nume, setNume] = useState(student.nume_prenume);
  const [clasa, setClasa] = useState(student.clasa ?? '');
  const [telefon, setTelefon] = useState(student.telefon ?? '');
  const [email, setEmail] = useState(student.email ?? '');
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    setSaving(true);
    try {
      await updateStudent(student.id, {
        nume_prenume: nume.trim(),
        clasa: clasa.trim() || null,
        telefon: telefon.trim() || null,
        email: email.trim() || null,
      });
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut salva.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Editează elevul">
      <Field label="Nume complet" value={nume} onChangeText={setNume} />
      <Field label="Clasa" value={clasa} onChangeText={setClasa} />
      <Field label="Telefon" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button label="Salvează" loading={saving} onPress={salveaza} />
    </Sheet>
  );
}

function EditConfigSheet({
  visible,
  student,
  contract,
  grupe,
  onClose,
  onSaved,
}: {
  visible: boolean;
  student: StudentRow;
  contract: ContractRow | null;
  grupe: GrupaRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pretStandard, setPretStandard] = useState(String(contract?.pret_standard ?? ''));
  const [reducere, setReducere] = useState(String((contract?.reducere_aplicata ?? 0) * 100));
  const [grupaId, setGrupaId] = useState<number | null>(contract?.grupa_id ?? null);
  const [saving, setSaving] = useState(false);

  const pretSesiune = useMemo(() => {
    const p = Number(pretStandard) || 0;
    const r = (Number(reducere) || 0) / 100;
    return Math.round(p * (1 - r) * 100) / 100;
  }, [pretStandard, reducere]);

  async function salveaza() {
    setSaving(true);
    try {
      await upsertContract({
        id: contract?.id,
        student_id: student.id,
        grupa_id: grupaId,
        pret_standard: Number(pretStandard) || 0,
        reducere_aplicata: (Number(reducere) || 0) / 100,
      });
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut salva.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Configurare financiară">
      <Text style={styles.sheetLabel}>Grupă</Text>
      <ChipSelect
        value={grupaId}
        onChange={setGrupaId}
        options={grupe.map((g) => ({ value: g.id, label: g.denumire }))}
      />
      <Field label="Preț standard (lei)" value={pretStandard} onChangeText={setPretStandard} keyboardType="numeric" />
      <Field label="Reducere (%)" value={reducere} onChangeText={setReducere} keyboardType="numeric" />
      <Row label="Preț sesiune (calculat)" value={lei(pretSesiune)} strong />
      <Button label="Salvează" loading={saving} onPress={salveaza} />
    </Sheet>
  );
}

// ---------- FINANCIAR ---------------------------------------------------------
function FinanciarSectiune({ dash }: { dash: StudentDashboardRow | null }) {
  const balanta = dash?.balanta ?? 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.metrics}>
        <Metric label="Ore Realizate" value={dash?.ore_realizate ?? 0} tone="blue" />
        <Metric label="Ore Achitate" value={dash?.ore_achitate ?? 0} tone="green" />
      </View>
      <Metric label="Balanță Curentă" value={balanta} tone={balanta < 0 ? 'red' : 'green'} />
      <Metric label="Venit total" value={lei(dash?.venit ?? 0)} />
    </View>
  );
}

// ---------- LECTII ------------------------------------------------------------
function LectiiSectiune({ lectii, grupa }: { lectii: LectieRow[]; grupa: GrupaRow | null }) {
  if (!grupa) return <EmptyState text="Elevul nu este atribuit unei grupe." />;
  if (lectii.length === 0) return <EmptyState text="Nicio lecție înregistrată." />;
  return (
    <View style={{ gap: 10 }}>
      {lectii.map((l) => {
        const c = statusLectieColor[l.status];
        return (
          <View key={l.id} style={styles.lectieRow}>
            <Text style={styles.lectieNr}>{l.nr ?? '-'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{l.subiect ?? 'Fără subiect'}</Text>
              <Text style={styles.muted}>{l.data ?? 'fără dată'}</Text>
              {l.recomandari ? <Text style={styles.reco}>{l.recomandari}</Text> : null}
            </View>
            <Badge label={l.status} bg={c.bg} fg={c.fg} />
          </View>
        );
      })}
    </View>
  );
}

// ---------- ACHITARI ----------------------------------------------------------
function AchitariSectiune({
  plati,
  datorii,
  contractId,
  studentId,
  esteAdmin,
  poateAchita,
  onReload,
}: {
  plati: PlataRow[];
  datorii: DatorieRow[];
  contractId: number | null;
  studentId: number;
  esteAdmin: boolean;
  poateAchita: boolean;
  onReload: () => Promise<void>;
}) {
  const [adauga, setAdauga] = useState(false);
  const [achitId, setAchitId] = useState<number | null>(null);
  const totalSesiuni = plati.reduce((s, p) => s + p.sesiuni, 0);
  const totalSuma = plati.reduce((s, p) => s + Number(p.suma), 0);

  async function achita(d: DatorieRow) {
    setAchitId(d.id);
    try {
      await achitaDatorie(d.id);
      await onReload();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut achita nota.');
    } finally {
      setAchitId(null);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Section title="NOTE DE PLATĂ" color={sectionColors.financiar}>
        {datorii.length === 0 ? (
          <EmptyState text="Nicio notă de plată generată." />
        ) : (
          datorii.map((d) => {
            const c = statusDatorieColor[d.status];
            return (
              <View key={d.id} style={styles.notaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{lei(d.suma)}</Text>
                  <Text style={styles.muted}>
                    {d.sesiuni} sesiuni · {d.data}
                  </Text>
                </View>
                <Badge label={d.status} bg={c.bg} fg={c.fg} />
                {d.status === 'NEACHITATA' && poateAchita ? (
                  <Button
                    label="Achită"
                    loading={achitId === d.id}
                    onPress={() => achita(d)}
                    style={styles.btnCompact}
                  />
                ) : null}
              </View>
            );
          })
        )}
      </Section>

      {esteAdmin ? <Button label="＋ Adaugă plată" onPress={() => setAdauga(true)} /> : null}

      <View style={styles.tabel}>
        <View style={[styles.trow, styles.thead]}>
          <Text style={[styles.th, { flex: 0.5 }]}>Nr</Text>
          <Text style={[styles.th, { flex: 1.3 }]}>Data</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: 'right' }]}>Sesiuni</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Sumă</Text>
        </View>
        {plati.length === 0 ? (
          <EmptyState text="Nicio achitare încă." />
        ) : (
          plati.map((p, i) => (
            <View key={p.id} style={styles.trow}>
              <Text style={[styles.td, { flex: 0.5 }]}>{i + 1}</Text>
              <Text style={[styles.td, { flex: 1.3 }]}>{p.data}</Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: 'right' }]}>{p.sesiuni}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: 'right', fontWeight: '700' }]}>
                {Number(p.suma).toLocaleString('ro-RO')}
              </Text>
            </View>
          ))
        )}
        {plati.length > 0 ? (
          <View style={[styles.trow, styles.tfoot]}>
            <Text style={[styles.td, { flex: 1.8, fontWeight: '800' }]}>TOTALURI</Text>
            <Text style={[styles.td, { flex: 0.8, textAlign: 'right', fontWeight: '800' }]}>{totalSesiuni}</Text>
            <Text style={[styles.td, { flex: 1.2, textAlign: 'right', fontWeight: '800' }]}>
              {totalSuma.toLocaleString('ro-RO')}
            </Text>
          </View>
        ) : null}
      </View>

      <AdaugaPlataSheet
        visible={adauga}
        studentId={studentId}
        contractId={contractId}
        onClose={() => setAdauga(false)}
        onSaved={async () => {
          setAdauga(false);
          await onReload();
        }}
      />
    </View>
  );
}

function AdaugaPlataSheet({
  visible,
  studentId,
  contractId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  studentId: number;
  contractId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const azi = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(azi);
  const [sesiuni, setSesiuni] = useState('');
  const [suma, setSuma] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    if (!sesiuni || !suma) {
      Alert.alert('Date lipsă', 'Completează sesiunile și suma.');
      return;
    }
    setSaving(true);
    try {
      await adaugaPlata({
        studentId,
        contractId,
        data,
        sesiuni: Number(sesiuni) || 0,
        suma: Number(suma) || 0,
        note: note.trim() || undefined,
      });
      setSesiuni('');
      setSuma('');
      setNote('');
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut salva plata.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Adaugă plată">
      <Field label="Data (AAAA-LL-ZZ)" value={data} onChangeText={setData} />
      <Field label="Sesiuni achitate" value={sesiuni} onChangeText={setSesiuni} keyboardType="numeric" />
      <Field label="Sumă (lei)" value={suma} onChangeText={setSuma} keyboardType="numeric" />
      <Field label="Notă (opțional)" value={note} onChangeText={setNote} />
      <Button label="Salvează plata" loading={saving} onPress={salveaza} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: 16, gap: 14 },
  metrics: { flexDirection: 'row', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  reco: { color: colors.amber, fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  lectieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  lectieNr: { fontSize: 16, fontWeight: '800', color: colors.primary, width: 24, textAlign: 'center' },
  notaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  btnCompact: { paddingVertical: 8, paddingHorizontal: 14 },
  sheetLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabel: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  thead: { backgroundColor: colors.green },
  th: { color: '#fff', fontWeight: '700', fontSize: 13 },
  td: { color: colors.text, fontSize: 14 },
  tfoot: { backgroundColor: '#F1F5F9' },
});
