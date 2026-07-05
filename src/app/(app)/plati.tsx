import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, ChipSelect, EmptyState, Field, Section, Sheet, colors, lei, sectionColors, statusDatorieColor } from '@/components/ui';
import { esteTutore as esteTutoreRol, ROLURI_ADMIN, useSession } from '@/lib/ctx';
import {
  achitaDatorie,
  adaugaPlata,
  genereazaDatorii,
  getContractStudent,
  listDatorii,
  listPlati,
  listStudenti,
} from '@/lib/queries';
import type { DatorieRow, PlataRow, StudentRow } from '@/lib/database.types';

export default function Plati() {
  const { profile } = useSession();
  const esteAdmin = !!profile && ROLURI_ADMIN.includes(profile.rol);
  const esteTutore = esteTutoreRol(profile?.rol);
  const poateAchita = esteAdmin || esteTutore;

  const [loading, setLoading] = useState(true);
  const [plati, setPlati] = useState<PlataRow[]>([]);
  const [studenti, setStudenti] = useState<StudentRow[]>([]);
  const [datorii, setDatorii] = useState<DatorieRow[]>([]);
  const [adauga, setAdauga] = useState(false);
  const [genereaza, setGenereaza] = useState(false);
  const [achitId, setAchitId] = useState<number | null>(null);

  const incarca = useCallback(async () => {
    const [p, s, d] = await Promise.all([listPlati(), listStudenti(), listDatorii()]);
    setPlati(p);
    setStudenti(s);
    setDatorii(d);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          await incarca();
        } catch (e) {
          Alert.alert('Eroare', e instanceof Error ? e.message : 'Eroare la incarcare.');
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [incarca]),
  );

  const numeStudent = useMemo(() => new Map(studenti.map((s) => [s.id, s.nume_prenume])), [studenti]);
  const total = plati.reduce((s, p) => s + Number(p.suma), 0);
  const datoriiNeachitate = useMemo(() => datorii.filter((d) => d.status === 'NEACHITATA'), [datorii]);
  const totalDatorii = datoriiNeachitate.reduce((s, d) => s + Number(d.suma), 0);

  async function genereazaNote() {
    setGenereaza(true);
    try {
      const n = await genereazaDatorii();
      Alert.alert('Note de plată', n > 0 ? `Am generat ${n} note de plată.` : 'Nu există note noi de generat.');
      await incarca();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut genera notele.');
    } finally {
      setGenereaza(false);
    }
  }

  async function achita(d: DatorieRow) {
    setAchitId(d.id);
    try {
      await achitaDatorie(d.id);
      await incarca();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut achita nota.');
    } finally {
      setAchitId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{esteTutore ? 'Total achitat' : 'Total încasat'}</Text>
        <Text style={styles.summaryValue}>{total.toLocaleString('ro-RO')} lei</Text>
      </View>

      {esteAdmin ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label="Generează note"
            variant="ghost"
            loading={genereaza}
            onPress={genereazaNote}
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border }}
          />
          <Button label="＋ Adaugă plată" onPress={() => setAdauga(true)} style={{ flex: 1 }} />
        </View>
      ) : null}

      <Section title={`NOTE DE PLATĂ NEACHITATE · ${lei(totalDatorii)}`} color={sectionColors.financiar}>
        {datoriiNeachitate.length === 0 ? (
          <EmptyState text="Nicio notă de plată neachitată." />
        ) : (
          datoriiNeachitate.map((d) => {
            const c = statusDatorieColor[d.status];
            return (
              <View key={d.id} style={styles.notaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{numeStudent.get(d.student_id) ?? `Elev #${d.student_id}`}</Text>
                  <Text style={styles.muted}>
                    {lei(d.suma)} · {d.sesiuni} sesiuni · {d.data}
                  </Text>
                </View>
                <Badge label={d.status} bg={c.bg} fg={c.fg} />
                {poateAchita ? (
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

      <Text style={styles.sectionHeading}>Istoric achitări</Text>
      {plati.length === 0 ? (
        <EmptyState text="Nicio plată înregistrată." />
      ) : (
        plati.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{numeStudent.get(p.student_id) ?? `Elev #${p.student_id}`}</Text>
              <Text style={styles.muted}>
                {p.data} · {p.sesiuni} sesiuni{p.note ? ` · ${p.note}` : ''}
              </Text>
            </View>
            <Text style={styles.suma}>{Number(p.suma).toLocaleString('ro-RO')} lei</Text>
          </View>
        ))
      )}

      <AdaugaPlataSheet
        visible={adauga}
        studenti={studenti}
        onClose={() => setAdauga(false)}
        onSaved={async () => {
          setAdauga(false);
          await incarca();
        }}
      />
    </ScrollView>
  );
}

function AdaugaPlataSheet({
  visible,
  studenti,
  onClose,
  onSaved,
}: {
  visible: boolean;
  studenti: StudentRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const azi = new Date().toISOString().slice(0, 10);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [data, setData] = useState(azi);
  const [sesiuni, setSesiuni] = useState('');
  const [suma, setSuma] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    if (!studentId) {
      Alert.alert('Selectează elevul', 'Alege un elev pentru plată.');
      return;
    }
    if (!sesiuni || !suma) {
      Alert.alert('Date lipsă', 'Completează sesiunile și suma.');
      return;
    }
    setSaving(true);
    try {
      const contract = await getContractStudent(studentId);
      await adaugaPlata({
        studentId,
        contractId: contract?.id ?? null,
        data,
        sesiuni: Number(sesiuni) || 0,
        suma: Number(suma) || 0,
        note: note.trim() || undefined,
      });
      setStudentId(null);
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
      <Text style={styles.label}>Elev</Text>
      <ChipSelect
        value={studentId}
        onChange={setStudentId}
        options={studenti.map((s) => ({ value: s.id, label: s.nume_prenume }))}
      />
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
  container: { padding: 16, gap: 10 },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  summaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  summaryValue: { color: colors.green, fontSize: 24, fontWeight: '800' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  notaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  btnCompact: { paddingVertical: 8, paddingHorizontal: 14 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  suma: { fontSize: 15, fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
