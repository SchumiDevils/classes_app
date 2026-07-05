import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button, ChipSelect, Field, Subtitle, colors } from '@/components/ui';
import { createStudent, listTutori } from '@/lib/queries';
import type { TutorRow } from '@/lib/database.types';

export default function ElevNou() {
  const router = useRouter();
  const [nume, setNume] = useState('');
  const [clasa, setClasa] = useState('');
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [tutorId, setTutorId] = useState<number | null>(null);
  const [tutori, setTutori] = useState<TutorRow[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listTutori().then(setTutori).catch(() => {});
    }, []),
  );

  async function salveaza() {
    if (!nume.trim()) {
      Alert.alert('Date lipsă', 'Completează numele elevului.');
      return;
    }
    setSaving(true);
    try {
      await createStudent({
        nume_prenume: nume.trim(),
        clasa: clasa.trim() || null,
        telefon: telefon.trim() || null,
        email: email.trim() || null,
        tutor_id: tutorId,
      });
      router.back();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut adăuga elevul.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Subtitle>Elevul se adaugă automat în organizația ta.</Subtitle>
      <Field label="Nume complet" value={nume} onChangeText={setNume} placeholder="Ion Popescu" />
      <Field label="Clasa" value={clasa} onChangeText={setClasa} placeholder="09" />
      <Field label="Telefon" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

      {tutori.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Tutore (opțional)</Text>
          <ChipSelect
            value={tutorId}
            onChange={(v) => setTutorId(v === tutorId ? null : v)}
            options={tutori.map((t) => ({ value: t.id, label: t.nume_prenume }))}
          />
        </View>
      ) : null}

      <View style={{ height: 6 }} />
      <Button label="Adaugă elevul" loading={saving} onPress={salveaza} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, backgroundColor: colors.bg, flexGrow: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
