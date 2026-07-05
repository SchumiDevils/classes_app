import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Subtitle, Title, colors } from '@/components/ui';
import { useSession } from '@/lib/ctx';
import type { TipOrganizatie } from '@/lib/database.types';

export default function Onboarding() {
  const { onboard, signOut, session } = useSession();
  const [numeOrganizatie, setNumeOrganizatie] = useState('');
  const [numePrenume, setNumePrenume] = useState('');
  const [specializare, setSpecializare] = useState('');
  const [tip, setTip] = useState<TipOrganizatie>('INDEPENDENT');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!numeOrganizatie.trim() || !numePrenume.trim()) {
      Alert.alert('Date lipsa', 'Completeaza numele organizatiei si numele tau.');
      return;
    }
    setLoading(true);
    try {
      await onboard({
        numeOrganizatie: numeOrganizatie.trim(),
        tip,
        numePrenume: numePrenume.trim(),
        specializare: tip === 'INDEPENDENT' ? specializare.trim() || undefined : undefined,
      });
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut crea organizatia.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Title>Bun venit!</Title>
        <Subtitle>Configureaza-ti organizatia ca sa incepi.</Subtitle>
        {session?.user.email ? (
          <Text style={styles.email}>{session.user.email}</Text>
        ) : null}
      </View>

      <Card style={{ gap: 14 }}>
        <View style={styles.segment}>
          <Segment
            label="Profesor independent"
            active={tip === 'INDEPENDENT'}
            onPress={() => setTip('INDEPENDENT')}
          />
          <Segment
            label="Firma / Centru"
            active={tip === 'COMPANIE'}
            onPress={() => setTip('COMPANIE')}
          />
        </View>

        <Field
          label={tip === 'COMPANIE' ? 'Numele centrului' : 'Numele activitatii'}
          value={numeOrganizatie}
          onChangeText={setNumeOrganizatie}
          placeholder={tip === 'COMPANIE' ? 'Centrul de Excelenta' : 'Meditatii Matematica'}
        />
        <Field
          label="Numele tau complet"
          value={numePrenume}
          onChangeText={setNumePrenume}
          placeholder="Ion Popescu"
        />
        {tip === 'INDEPENDENT' ? (
          <Field
            label="Specializare (optional)"
            value={specializare}
            onChangeText={setSpecializare}
            placeholder="Matematica"
          />
        ) : null}

        <Button label="Creeaza organizatia" loading={loading} onPress={onSubmit} />
      </Card>

      <Button variant="ghost" label="Deconecteaza-te" onPress={signOut} />
    </ScrollView>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentItem, active && styles.segmentItemActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: colors.bg },
  header: { gap: 6, alignItems: 'center' },
  email: { color: colors.muted, fontSize: 13 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segmentText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: colors.primary },
});
