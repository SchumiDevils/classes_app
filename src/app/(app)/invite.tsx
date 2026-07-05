import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Card, Field, Subtitle, colors } from '@/components/ui';
import { mesajEroare } from '@/lib/errors';
import { inviteUtilizator } from '@/lib/queries';
import type { Rol } from '@/lib/database.types';

const ROLURI: { value: Rol; label: string }[] = [
  { value: 'PROFESOR', label: 'Profesor' },
  { value: 'TUTOR', label: 'Tutore' },
  { value: 'STUDENT', label: 'Elev' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function Invite() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [numePrenume, setNumePrenume] = useState('');
  const [rol, setRol] = useState<Rol>('PROFESOR');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !numePrenume.trim()) {
      Alert.alert('Date lipsa', 'Completeaza numele si emailul.');
      return;
    }
    setLoading(true);
    try {
      await inviteUtilizator({ email: email.trim(), rol, numePrenume: numePrenume.trim() });
      Alert.alert(
        'Invitatie creata',
        `${numePrenume} a fost adaugat ca ${rol}. Se poate inregistra cu emailul ${email} pentru a-si activa contul.`,
      );
      router.back();
    } catch (e) {
      Alert.alert('Eroare', mesajEroare(e, 'Nu am putut trimite invitatia.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Subtitle>Adaugi un membru in organizatie. Contul se activeaza cand se inregistreaza cu acelasi email.</Subtitle>

      <Card style={{ gap: 14 }}>
        <View>
          <Text style={styles.label}>Rol</Text>
          <View style={styles.roluri}>
            {ROLURI.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRol(r.value)}
                style={[styles.chip, rol === r.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, rol === r.value && styles.chipTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field
          label="Nume complet"
          value={numePrenume}
          onChangeText={setNumePrenume}
          placeholder="Maria Ionescu"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="maria@exemplu.com"
        />

        <Button label="Trimite invitatia" loading={loading} onPress={onSubmit} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, backgroundColor: colors.bg, flexGrow: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 8 },
  roluri: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
});
