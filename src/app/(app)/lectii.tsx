import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  Badge,
  Button,
  ChipSelect,
  EmptyState,
  Field,
  Sheet,
  colors,
  statusLectieColor,
} from '@/components/ui';
import { ROLURI_STAFF, useSession } from '@/lib/ctx';
import { createLectie, listGrupe, listLectiiGrupa } from '@/lib/queries';
import type { GrupaRow, LectieRow } from '@/lib/database.types';

export default function Lectii() {
  const router = useRouter();
  const { profile } = useSession();
  const poateEdita = !!profile && ROLURI_STAFF.includes(profile.rol);

  const [loading, setLoading] = useState(true);
  const [grupe, setGrupe] = useState<GrupaRow[]>([]);
  const [grupaId, setGrupaId] = useState<number | null>(null);
  const [lectii, setLectii] = useState<LectieRow[]>([]);
  const [adauga, setAdauga] = useState(false);

  const incarcaLectii = useCallback(async (gid: number) => {
    setLectii(await listLectiiGrupa(gid));
  }, []);

  const incarca = useCallback(async () => {
    const g = await listGrupe();
    setGrupe(g);
    const gid = g[0]?.id ?? null;
    setGrupaId((prev) => prev ?? gid);
    const target = grupaId ?? gid;
    if (target) await incarcaLectii(target);
  }, [grupaId, incarcaLectii]);

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

  const selecteazaGrupa = useCallback(
    async (gid: number) => {
      setGrupaId(gid);
      try {
        await incarcaLectii(gid);
      } catch (e) {
        Alert.alert('Eroare', e instanceof Error ? e.message : 'Eroare.');
      }
    },
    [incarcaLectii],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (grupe.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState text="Nicio grupă încă. Creează o grupă și definește orarul pentru a genera lecții." />
        {poateEdita ? (
          <View style={{ marginTop: 12, alignSelf: 'stretch' }}>
            <Button label="Grupe & orar" onPress={() => router.push('/grupe')} />
          </View>
        ) : null}
      </View>
    );
  }

  const urmatorulNr = (lectii.reduce((m, l) => Math.max(m, l.nr ?? 0), 0) || 0) + 1;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <ChipSelect
        value={grupaId}
        onChange={selecteazaGrupa}
        options={grupe.map((g) => ({ value: g.id, label: g.denumire }))}
      />

      {poateEdita ? (
        <View style={styles.actions}>
          <Button label="＋ Adaugă lecție" onPress={() => setAdauga(true)} style={{ flex: 1 }} />
          <Button
            variant="ghost"
            label="Grupe & orar"
            onPress={() => router.push('/grupe')}
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border }}
          />
        </View>
      ) : null}

      {lectii.length === 0 ? (
        <EmptyState text="Nicio lecție în această grupă." />
      ) : (
        lectii.map((l) => {
          const c = statusLectieColor[l.status];
          return (
            <Pressable
              key={l.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/lectie/[id]', params: { id: l.id } })}
            >
              <Text style={styles.nr}>{l.nr ?? '-'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{l.subiect ?? 'Fără subiect'}</Text>
                <Text style={styles.muted}>{l.data ?? 'fără dată'}</Text>
              </View>
              <Badge label={l.status} bg={c.bg} fg={c.fg} />
            </Pressable>
          );
        })
      )}

      {grupaId ? (
        <AdaugaLectieSheet
          visible={adauga}
          grupaId={grupaId}
          nrSugerat={urmatorulNr}
          onClose={() => setAdauga(false)}
          onSaved={async () => {
            setAdauga(false);
            if (grupaId) await incarcaLectii(grupaId);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function AdaugaLectieSheet({
  visible,
  grupaId,
  nrSugerat,
  onClose,
  onSaved,
}: {
  visible: boolean;
  grupaId: number;
  nrSugerat: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const azi = new Date().toISOString().slice(0, 10);
  const [nr, setNr] = useState(String(nrSugerat));
  const [data, setData] = useState(azi);
  const [subiect, setSubiect] = useState('');
  const [saving, setSaving] = useState(false);

  async function salveaza() {
    setSaving(true);
    try {
      await createLectie({
        grupa_id: grupaId,
        nr: Number(nr) || null,
        data: data || null,
        subiect: subiect.trim() || null,
      });
      setSubiect('');
      onSaved();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut adăuga lecția.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Adaugă lecție">
      <Field label="Nr" value={nr} onChangeText={setNr} keyboardType="numeric" />
      <Field label="Data (AAAA-LL-ZZ)" value={data} onChangeText={setData} />
      <Field label="Subiectul lecției" value={subiect} onChangeText={setSubiect} placeholder="Ex: Ecuații" />
      <Button label="Salvează" loading={saving} onPress={salveaza} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  container: { padding: 16, gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  nr: { fontSize: 16, fontWeight: '800', color: colors.primary, width: 24, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
