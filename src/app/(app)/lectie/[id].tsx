import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Button, EmptyState, Field, Section, Segmented, colors, sectionColors } from '@/components/ui';
import { ROLURI_STAFF, useSession } from '@/lib/ctx';
import { getLectie, getPrezentaLectie, setPrezenta, updateLectie, type PrezentaElev } from '@/lib/queries';
import type { LectieRow, StatusLectie } from '@/lib/database.types';

export default function DetaliuLectie() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lectieId = Number(id);
  const router = useRouter();
  const { profile } = useSession();
  const poateEdita = !!profile && ROLURI_STAFF.includes(profile.rol);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lectie, setLectie] = useState<LectieRow | null>(null);
  const [prezente, setPrezente] = useState<PrezentaElev[]>([]);

  const [subiect, setSubiect] = useState('');
  const [data, setData] = useState('');
  const [status, setStatus] = useState<StatusLectie>('PLANIFICATA');
  const [recomandari, setRecomandari] = useState('');

  const incarca = useCallback(async () => {
    const l = await getLectie(lectieId);
    setLectie(l);
    if (l) {
      setSubiect(l.subiect ?? '');
      setData(l.data ?? '');
      setStatus(l.status);
      setRecomandari(l.recomandari ?? '');
      setPrezente(await getPrezentaLectie(lectieId, l.grupa_id));
    }
  }, [lectieId]);

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

  async function salveaza() {
    setSaving(true);
    try {
      await updateLectie(lectieId, {
        subiect: subiect.trim() || null,
        data: data.trim() || null,
        status,
        recomandari: recomandari.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut salva.');
    } finally {
      setSaving(false);
    }
  }

  async function comutaPrezenta(p: PrezentaElev, val: boolean) {
    setPrezente((prev) =>
      prev.map((x) => (x.student_id === p.student_id ? { ...x, prezent: val } : x)),
    );
    try {
      await setPrezenta({
        lectie_id: lectieId,
        student_id: p.student_id,
        prezent: val,
        prezenta_id: p.prezenta_id,
      });
      // reincarcam ca sa prindem prezenta_id nou creat
      if (lectie) setPrezente(await getPrezentaLectie(lectieId, lectie.grupa_id));
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut salva prezența.');
      setPrezente((prev) =>
        prev.map((x) => (x.student_id === p.student_id ? { ...x, prezent: !val } : x)),
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!lectie) {
    return (
      <View style={styles.center}>
        <EmptyState text="Lecția nu a fost găsită." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Lecția #${lectie.nr ?? ''}` }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
        <Field label="Subiectul lecției" value={subiect} onChangeText={setSubiect} editable={poateEdita} />
        <Field label="Data (AAAA-LL-ZZ)" value={data} onChangeText={setData} editable={poateEdita} />

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Status</Text>
          <Segmented<StatusLectie>
            value={status}
            onChange={poateEdita ? setStatus : () => {}}
            options={[
              { value: 'PLANIFICATA', label: 'Planificată' },
              { value: 'REALIZATA', label: 'Realizată' },
              { value: 'ANULATA', label: 'Anulată' },
            ]}
          />
        </View>

        <Field
          label="Recomandări"
          value={recomandari}
          onChangeText={setRecomandari}
          editable={poateEdita}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Section title="PREZENȚĂ" color={sectionColors.tutore}>
          {prezente.length === 0 ? (
            <EmptyState text="Niciun elev în grupă (adaugă contracte cu această grupă)." />
          ) : (
            prezente.map((p) => (
              <View key={p.student_id} style={styles.prezRow}>
                <Text style={styles.prezName}>{p.nume_prenume}</Text>
                <Switch
                  value={p.prezent}
                  disabled={!poateEdita}
                  onValueChange={(v) => comutaPrezenta(p, v)}
                  trackColor={{ true: colors.green }}
                />
              </View>
            ))
          )}
        </Section>

        {poateEdita ? <Button label="Salvează lecția" loading={saving} onPress={salveaza} /> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: 16, gap: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  prezRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  prezName: { fontSize: 15, color: colors.text, fontWeight: '500' },
});
