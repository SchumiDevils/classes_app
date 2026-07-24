import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  ChipSelect,
  EmptyState,
  Field,
  Row,
  Section,
  Sheet,
  colors,
  sectionColors,
} from '@/components/ui';
import { ROLURI_ADMIN, useSession } from '@/lib/ctx';
import { mesajEroare } from '@/lib/errors';
import {
  createOrar,
  deleteGrupa,
  deleteOrar,
  genereazaLectii,
  getGrupa,
  getOrarGrupa,
  listProfesori,
  listTipuriContract,
  updateGrupa,
} from '@/lib/queries';
import type { GrupaRow, OrarRow, ProfesorRow, TipContractRow, Ziua } from '@/lib/database.types';

const ZILE: { value: Ziua; label: string }[] = [
  { value: 'LUNI', label: 'Luni' },
  { value: 'MARTI', label: 'Marți' },
  { value: 'MIERCURI', label: 'Miercuri' },
  { value: 'JOI', label: 'Joi' },
  { value: 'VINERI', label: 'Vineri' },
  { value: 'SAMBATA', label: 'Sâmbătă' },
  { value: 'DUMINICA', label: 'Duminică' },
];
const ZIUA_LABEL: Record<string, string> = Object.fromEntries(ZILE.map((z) => [z.value, z.label]));

export default function GrupaDetaliu() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const grupaId = Number(id);
  const router = useRouter();
  const { profile } = useSession();
  const esteAdmin = !!profile && ROLURI_ADMIN.includes(profile.rol);

  const [loading, setLoading] = useState(true);
  const [grupa, setGrupa] = useState<GrupaRow | null>(null);
  const [orar, setOrar] = useState<OrarRow[]>([]);
  const [profesori, setProfesori] = useState<ProfesorRow[]>([]);
  const [tipuri, setTipuri] = useState<TipContractRow[]>([]);
  const [editGrupa, setEditGrupa] = useState(false);
  const [adaugaOrar, setAdaugaOrar] = useState(false);
  const [genereaza, setGenereaza] = useState(false);

  const incarca = useCallback(async () => {
    const [g, o, p, t] = await Promise.all([
      getGrupa(grupaId),
      getOrarGrupa(grupaId),
      listProfesori(),
      listTipuriContract(),
    ]);
    setGrupa(g);
    setOrar(o);
    setProfesori(p);
    setTipuri(t);
  }, [grupaId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          await incarca();
        } catch (e) {
          Alert.alert('Eroare', mesajEroare(e, 'Nu am putut încărca grupa.'));
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [incarca]),
  );

  const profesor = useMemo(
    () => profesori.find((p) => p.id === grupa?.profesor_id) ?? null,
    [profesori, grupa],
  );
  const tip = useMemo(() => tipuri.find((t) => t.id === grupa?.tip_contract_id) ?? null, [tipuri, grupa]);

  async function stergeSlot(slot: OrarRow) {
    try {
      await deleteOrar(slot.id);
      await incarca();
    } catch (e) {
      Alert.alert('Eroare', mesajEroare(e, 'Nu am putut șterge intervalul.'));
    }
  }

  function confirmaStergereGrupa() {
    Alert.alert(
      'Ștergi grupa?',
      'Se șterg și lecțiile și orarul asociate. Contractele elevilor rămân, dar fără grupă. Acțiunea nu poate fi anulată.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGrupa(grupaId);
              router.back();
            } catch (e) {
              Alert.alert('Eroare', mesajEroare(e, 'Nu am putut șterge grupa.'));
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!grupa) {
    return (
      <View style={styles.center}>
        <EmptyState text="Grupa nu a fost găsită." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: grupa.denumire }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        <Section title="GRUPĂ" color={sectionColors.elev}>
          <Row label="Denumire" value={grupa.denumire} />
          <Row label="Profesor" value={profesor?.nume_prenume ?? '—'} />
          <Row label="Tip contract" value={tip?.denumire ?? '—'} />
        </Section>
        {esteAdmin ? (
          <Button variant="ghost" label="Editează grupa" onPress={() => setEditGrupa(true)} />
        ) : null}

        <Section title="ORAR SĂPTĂMÂNAL" color={sectionColors.orar}>
          {orar.length === 0 ? (
            <EmptyState text="Niciun interval definit." />
          ) : (
            orar.map((o) => (
              <View key={o.id} style={styles.slotRow}>
                <Text style={styles.slotText}>
                  {ZIUA_LABEL[o.ziua]} · {o.ora.slice(0, 5)}
                </Text>
                {esteAdmin ? (
                  <Pressable onPress={() => stergeSlot(o)} hitSlop={8}>
                    <Text style={styles.sterge}>Șterge</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </Section>
        {esteAdmin ? (
          <Button variant="ghost" label="＋ Adaugă interval" onPress={() => setAdaugaOrar(true)} />
        ) : null}

        <Section title="GENERARE LECȚII" color={sectionColors.financiar}>
          <Text style={styles.hint}>
            Creează automat lecțiile PLANIFICATE pentru zilele din orar, într-un interval de date. Zilele care au
            deja o lecție sunt sărite.
          </Text>
        </Section>
        {esteAdmin ? (
          <Button
            label="Generează lecții"
            onPress={() => setGenereaza(true)}
            disabled={orar.length === 0}
          />
        ) : null}

        {esteAdmin ? (
          <>
            <View style={{ height: 8 }} />
            <Button variant="danger" label="Șterge grupa" onPress={confirmaStergereGrupa} />
          </>
        ) : null}

        <EditGrupaSheet
          visible={editGrupa}
          grupa={grupa}
          profesori={profesori}
          tipuri={tipuri}
          onClose={() => setEditGrupa(false)}
          onSaved={async () => {
            setEditGrupa(false);
            await incarca();
          }}
        />
        <AdaugaOrarSheet
          visible={adaugaOrar}
          grupaId={grupaId}
          onClose={() => setAdaugaOrar(false)}
          onSaved={async () => {
            setAdaugaOrar(false);
            await incarca();
          }}
        />
        <GenereazaSheet
          visible={genereaza}
          grupaId={grupaId}
          onClose={() => setGenereaza(false)}
          onDone={async () => {
            setGenereaza(false);
            await incarca();
          }}
        />
      </ScrollView>
    </>
  );
}

function EditGrupaSheet({
  visible,
  grupa,
  profesori,
  tipuri,
  onClose,
  onSaved,
}: {
  visible: boolean;
  grupa: GrupaRow;
  profesori: ProfesorRow[];
  tipuri: TipContractRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [denumire, setDenumire] = useState(grupa.denumire);
  const [profesorId, setProfesorId] = useState<number | null>(grupa.profesor_id);
  const [tipId, setTipId] = useState<number | null>(grupa.tip_contract_id);
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    if (!denumire.trim()) {
      Alert.alert('Date lipsă', 'Completează denumirea.');
      return;
    }
    setSaving(true);
    try {
      await updateGrupa(grupa.id, {
        denumire: denumire.trim(),
        profesor_id: profesorId,
        tip_contract_id: tipId,
      });
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', mesajEroare(e, 'Nu am putut salva.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Editează grupa">
      <Field label="Denumire" value={denumire} onChangeText={setDenumire} />
      {profesori.length > 0 ? (
        <>
          <Text style={styles.label}>Profesor</Text>
          <ChipSelect
            value={profesorId}
            onChange={setProfesorId}
            options={profesori.map((p) => ({ value: p.id, label: p.nume_prenume }))}
          />
        </>
      ) : null}
      {tipuri.length > 0 ? (
        <>
          <Text style={styles.label}>Tip contract</Text>
          <ChipSelect
            value={tipId}
            onChange={setTipId}
            options={tipuri.map((t) => ({ value: t.id, label: t.denumire }))}
          />
        </>
      ) : null}
      <Button label="Salvează" loading={saving} onPress={salveaza} />
    </Sheet>
  );
}

function AdaugaOrarSheet({
  visible,
  grupaId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  grupaId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ziua, setZiua] = useState<Ziua>('LUNI');
  const [ora, setOra] = useState('16:00');
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    if (!/^\d{1,2}:\d{2}$/.test(ora.trim())) {
      Alert.alert('Oră invalidă', 'Folosește formatul HH:MM (ex: 16:45).');
      return;
    }
    setSaving(true);
    try {
      await createOrar({ grupa_id: grupaId, ziua, ora: ora.trim() });
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', mesajEroare(e, 'Nu am putut adăuga intervalul.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Adaugă interval">
      <Text style={styles.label}>Ziua</Text>
      <ChipSelect value={ziua} onChange={setZiua} options={ZILE} />
      <Field label="Ora (HH:MM)" value={ora} onChangeText={setOra} keyboardType="numbers-and-punctuation" />
      <Button label="Adaugă" loading={saving} onPress={salveaza} />
    </Sheet>
  );
}

function GenereazaSheet({
  visible,
  grupaId,
  onClose,
  onDone,
}: {
  visible: boolean;
  grupaId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const azi = new Date().toISOString().slice(0, 10);
  const peste30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(azi);
  const [sfarsit, setSfarsit] = useState(peste30);
  const [saving, setSaving] = useState(false);

  async function ruleaza() {
    setSaving(true);
    try {
      const n = await genereazaLectii({ grupaId, dataStart: start, dataSfarsit: sfarsit });
      Alert.alert(
        'Generare lecții',
        n > 0 ? `Am creat ${n} lecții planificate.` : 'Nicio lecție nouă (posibil deja generate).',
      );
      onDone();
    } catch (e) {
      Alert.alert('Eroare', mesajEroare(e, 'Nu am putut genera lecțiile.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Generează lecții">
      <Field label="De la data (AAAA-LL-ZZ)" value={start} onChangeText={setStart} />
      <Field label="Până la data (AAAA-LL-ZZ)" value={sfarsit} onChangeText={setSfarsit} />
      <Button label="Generează" loading={saving} onPress={ruleaza} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  container: { padding: 16, gap: 12 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slotText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  sterge: { color: colors.red, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
