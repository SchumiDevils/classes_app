import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button, Row, Section, colors, lei, procent, sectionColors } from '@/components/ui';
import { ROLURI_ADMIN, useSession } from '@/lib/ctx';
import { mesajEroare } from '@/lib/errors';
import { listTipuriContract, stergeDateDemo } from '@/lib/queries';
import type { TipContractRow } from '@/lib/database.types';

export default function Setari() {
  const { profile, signOut } = useSession();
  const router = useRouter();
  const esteAdmin = !!profile && ROLURI_ADMIN.includes(profile.rol);

  const [loading, setLoading] = useState(true);
  const [tipuri, setTipuri] = useState<TipContractRow[]>([]);
  const [stergand, setStergand] = useState(false);

  const stergeDate = useCallback(() => {
    Alert.alert(
      'Ștergi datele de test?',
      'Se șterg toți elevii, grupele, contractele, lecțiile, prezențele, plățile și notele de plată din organizație. Conturile de utilizator rămân. Acțiunea nu poate fi anulată.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            setStergand(true);
            try {
              const msg = await stergeDateDemo();
              Alert.alert('Gata', msg);
            } catch (e) {
              Alert.alert('Eroare', mesajEroare(e, 'Nu am putut șterge datele.'));
            } finally {
              setStergand(false);
            }
          },
        },
      ],
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          setTipuri(await listTipuriContract());
        } catch {
          // ignoram
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Section title="ORGANIZAȚIE" color={sectionColors.elev}>
        <Row label="Nume" value={profile?.organizatie ?? '—'} />
        <Row label="Tip" value={profile?.tip_organizatie ?? '—'} />
        <Row label="Contul tău" value={profile?.nume_prenume ?? '—'} />
        <Row label="Rol" value={profile?.rol ?? '—'} />
        <Row label="Email" value={profile?.email ?? '—'} />
      </Section>

      <Section title="TARIFAR (TIPURI CONTRACT)" color={sectionColors.financiar}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ margin: 12 }} />
        ) : tipuri.length === 0 ? (
          <Row label="Tarifar" value="Niciun tip definit" />
        ) : (
          tipuri.map((t) => (
            <Row
              key={t.id}
              label={`${t.denumire} (${t.cod})`}
              value={`${lei(t.pret_standard)} · loial. ${procent(t.reducere_loialitate)}`}
            />
          ))
        )}
      </Section>

      {esteAdmin ? (
        <>
          <Button label="Invită profesor / elev / tutore" onPress={() => router.push('/invite')} />
          <Button
            variant="danger"
            label="Șterge datele de test"
            loading={stergand}
            onPress={stergeDate}
          />
        </>
      ) : null}

      <View style={{ height: 4 }} />
      <Button variant="danger" label="Deconectează-te" onPress={signOut} />

      <Text style={styles.version}>Centrul de Lecții · MVP</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 8 },
});
