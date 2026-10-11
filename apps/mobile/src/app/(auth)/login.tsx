import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { LoginSchema } from '@worktrail/types';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../auth/auth-store';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { WEB_URL } from '../../config';
import { colors, fonts } from '../../theme/theme';

type Errors = Partial<Record<'email' | 'password', string>>;

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof Errors] ??= i.message;
      return setErrors(next);
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Logo />
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.sub}>For admins and returning employees. Use the email and password you set.</Text>
      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="you@company.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
      />
      {formError ? <Notice tone="warning">{formError}</Notice> : null}
      <Button title="Sign in" loading={busy} onPress={() => void submit()} />
      <Text
        accessibilityRole="link"
        style={styles.link}
        onPress={() => void Linking.openURL(`${WEB_URL}/forgot-password`)}
      >
        Forgot password?
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink900, marginTop: 24 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  link: {
    fontFamily: fonts.semibold,
    color: colors.brand700,
    fontSize: 16,
    textAlign: 'center',
    padding: 8,
  },
});
