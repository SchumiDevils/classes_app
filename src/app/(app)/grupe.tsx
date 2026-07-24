import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { Button, ChipSelect, EmptyState, Field, Sheet, colors } from '@/components/ui';
import { ROLURI_ADMIN, useSession } from '@/lib/ctx';
import { mesajEroare } from '@/lib/errors';
import { createGrupa, listGrupe, listProfesori, listTipuriContract } from '@/lib/queries';
import type { GrupaRow, ProfesorRow, TipContractRow } from '@/lib/database.types';

export default function Grupe() {
  const router = useRouter();
  const { profile } = useSession();
  const esteAdmin = !!profile && ROLURI_ADMIN.includes(profile.rol);

  const [loading, setLoading] = useState(true);
  const [grupe, setGrupe] = useState<GrupaRow[]>([]);
  const [profesori, setProfesori] = useState<ProfesorRow[]>([]);
  const [tipuri, setTipuri] = useState<TipContractRow[]>([]);
  const [adauga, setAdauga] = useState(false);

  const incarca = useCallback(async () => {
    const [g, p, t] = await Promise.all([listGrupe(), listProfesori(), listTipuriContract()]);
    setGrupe(g);
    setProfesori(p);
    setTipuri(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          await incarca();
        } catch (e) {
          Alert.alert('Eroare', mesajEroare(e, 'Eroare la incarcare.'));
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [incarca]),
  );

  const numeProfesor = useMemo(
    () => new Map(profesori.map((p) => [p.id, p.nume_prenume])),
    [profesori],
  );
  const numeTip = useMemo(() => new Map(tipuri.map((t) => [t.id, t.denumire])), [tipuri]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Grupe & orar' }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        {esteAdmin ? <Button label="＋ Grupă nouă" onPress={() => setAdauga(true)} /> : null}

        {grupe.length === 0 ? (
          <EmptyState text="Nicio grupă. Creează prima grupă pentru a defini orarul și a genera lecții." />
        ) : (
          grupe.map((g) => (
            <Pressable
              key={g.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/grupa/[id]', params: { id: g.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{g.denumire}</Text>
                <Text style={styles.muted}>
                  {g.profesor_id ? numeProfesor.get(g.profesor_id) ?? 'Profesor' : 'Fără profesor'}
                  {g.tip_contract_id ? ` · ${numeTip.get(g.tip_contract_id) ?? ''}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}

        <GrupaNouaSheet
          visible={adauga}
          profesori={profesori}
          tipuri={tipuri}
          onClose={() => setAdauga(false)}
          onSaved={async () => {
            setAdauga(false);
            await incarca();
          }}
        />
      </ScrollView>
    </>
  );
}

function GrupaNouaSheet({
  visible,
  profesori,
  tipuri,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profesori: ProfesorRow[];
  tipuri: TipContractRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [denumire, setDenumire] = useState('');
  const [profesorId, setProfesorId] = useState<number | null>(null);
  const [tipId, setTipId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    if (!denumire.trim()) {
      Alert.alert('Date lipsă', 'Completează denumirea grupei.');
      return;
    }
    setSaving(true);
    try {
      await createGrupa({
        denumire: denumire.trim(),
        profesor_id: profesorId,
        tip_contract_id: tipId,
      });
      setDenumire('');
      setProfesorId(null);
      setTipId(null);
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', mesajEroare(e, 'Nu am putut crea grupa.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Grupă nouă">
      <Field label="Denumire" value={denumire} onChangeText={setDenumire} placeholder="Ex: Grupa Matematică (cl. 9)" />
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  container: { padding: 16, gap: 10 },
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
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 22, fontWeight: '300' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
