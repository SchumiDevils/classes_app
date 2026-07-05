import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, Field, Subtitle, Title, colors } from '@/components/ui';
import { useSession } from '@/lib/ctx';

export default function SignIn() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [parola, setParola] = useState('');
  const [loading, setLoading] = useState(false);

  const esteLogin = mode === 'login';

  async function onSubmit() {
    if (!email.trim() || !parola) {
      Alert.alert('Date lipsa', 'Completeaza email si parola.');
      return;
    }
    setLoading(true);
    try {
      if (esteLogin) {
        await signIn(email.trim(), parola);
      } else {
        const { needsConfirm } = await signUp(email.trim(), parola);
        if (needsConfirm) {
          Alert.alert(
            'Verifica emailul',
            'Ti-am trimis un link de confirmare. Confirma adresa si apoi autentifica-te.',
          );
          setMode('login');
        }
      }
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Ceva nu a mers.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>Centrul de Lectii</Text>
          <Subtitle>Gestioneaza elevi, lectii si plati intr-un singur loc.</Subtitle>
        </View>

        <Card style={styles.card}>
          <Title>{esteLogin ? 'Autentificare' : 'Creeaza cont'}</Title>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="nume@exemplu.com"
          />
          <Field
            label="Parola"
            value={parola}
            onChangeText={setParola}
            secureTextEntry
            autoComplete={esteLogin ? 'current-password' : 'new-password'}
            placeholder="Minim 6 caractere"
          />
          <View style={{ height: 6 }} />
          <Button
            label={esteLogin ? 'Intra in cont' : 'Inregistreaza-te'}
            loading={loading}
            onPress={onSubmit}
          />
          <Button
            variant="ghost"
            label={esteLogin ? 'Nu ai cont? Creeaza unul' : 'Ai deja cont? Autentifica-te'}
            onPress={() => setMode(esteLogin ? 'register' : 'login')}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  header: { alignItems: 'center', gap: 8 },
  logo: { fontSize: 28, fontWeight: '800', color: colors.primary },
  card: { gap: 12 },
});
