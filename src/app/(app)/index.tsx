import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Badge, Button, EmptyState, colors } from '@/components/ui';
import { ROLURI_ADMIN, useSession } from '@/lib/ctx';
import { getOrgDashboard, listEleviCuBalanta, seedDemoData, type ElevListItem } from '@/lib/queries';
import type { OrgDashboardRow } from '@/lib/database.types';

export default function Elevi() {
  const { profile } = useSession();
  const router = useRouter();
  const esteAdmin = !!profile && ROLURI_ADMIN.includes(profile.rol);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elevi, setElevi] = useState<ElevListItem[]>([]);
  const [org, setOrg] = useState<OrgDashboardRow | null>(null);

  const incarca = useCallback(async () => {
    setError(null);
    try {
      const [e, o] = await Promise.all([listEleviCuBalanta(), getOrgDashboard()]);
      setElevi(e);
      setOrg(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la incarcare.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await incarca();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [incarca]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await incarca();
    setRefreshing(false);
  }, [incarca]);

  const onSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const msg = await seedDemoData();
      Alert.alert('Date demo', msg);
      await incarca();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu am putut incarca datele demo.');
    } finally {
      setSeeding(false);
    }
  }, [incarca]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      data={elevi}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <View style={styles.summaryRow}>
            <Summary label="Elevi" value={elevi.length} />
            <Summary label="Venit total" value={`${Math.round(org?.venit_total ?? 0)}`} tone="green" />
            <Summary
              label="Restanțe"
              value={org?.elevi_cu_restanta ?? 0}
              tone={(org?.elevi_cu_restanta ?? 0) > 0 ? 'red' : undefined}
            />
          </View>

          {esteAdmin ? (
            <Button label="＋ Adaugă elev" onPress={() => router.push('/elev-nou')} />
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={{ color: colors.red }}>{error}</Text>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.rowCard}
          onPress={() => router.push({ pathname: '/student/[id]', params: { id: item.id } })}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.nume_prenume}</Text>
            <Text style={styles.muted}>
              {item.clasa ? `Clasa ${item.clasa} · ` : ''}Realizate {item.ore_realizate} · Achitate{' '}
              {item.ore_achitate}
            </Text>
          </View>
          <Badge
            label={`${item.balanta}`}
            bg={item.balanta < 0 ? colors.redSoft : colors.greenSoft}
            fg={item.balanta < 0 ? colors.red : colors.green}
          />
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={{ gap: 12 }}>
          <EmptyState text="Niciun elev încă." />
          {esteAdmin ? (
            <Button
              variant="ghost"
              label="Încarcă date demo (din foile de calcul)"
              loading={seeding}
              onPress={onSeed}
            />
          ) : null}
        </View>
      }
    />
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'green' | 'red';
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'green' && { color: colors.green },
          tone === 'red' && { color: colors.red },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: 16, gap: 10 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summary: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 2,
  },
  summaryLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  summaryValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  errorBox: { backgroundColor: colors.redSoft, borderRadius: 12, padding: 12 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
