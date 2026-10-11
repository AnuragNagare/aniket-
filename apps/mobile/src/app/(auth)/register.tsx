import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminSignupSchema } from '@worktrail/types';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../auth/auth-store';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, fonts } from '../../theme/theme';

type Field = 'companyName' | 'name' | 'email' | 'phone' | 'password';
type Errors = Partial<Record<Field, string>>;

/** Admin sign-up: creates the company and its owner in one step, then signs them in. */
export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [values, setValues] = useState<Record<Field, string>>({
    companyName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: Field) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setFormError(null);
    const parsed = AdminSignupSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as Field] ??= i.message;
      return setErrors(next);
    }
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Logo />
      <Text style={styles.title}>Create your company account</Text>
      <Text style={styles.sub}>
        For company admins. You will invite your employees and see their work from here.
      </Text>
      <TextField
        label="Company name"
        value={values.companyName}
        onChangeText={set('companyName')}
        error={errors.companyName}
        autoComplete="organization"
      />
      <TextField
        label="Your name"
        value={values.name}
        onChangeText={set('name')}
        error={errors.name}
        autoComplete="name"
      />
      <TextField
        label="Email address"
        value={values.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="you@company.com"
      />
      <TextField
        label="Mobile number"
        value={values.phone}
        onChangeText={set('phone')}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        hint="Indian mobile number"
      />
      <TextField
        label="Password"
        value={values.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        hint="At least 8 characters"
      />
      {formError ? <Notice tone="warning">{formError}</Notice> : null}
      <Button title="Create account" loading={busy} onPress={() => void submit()} />
      <Text accessibilityRole="link" style={styles.link} onPress={() => router.replace('/login')}>
        Already have an account? Sign in
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900, marginTop: 16 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  link: {
    fontFamily: fonts.semibold,
    color: colors.brand700,
    fontSize: 16,
    textAlign: 'center',
    padding: 8,
  },
});
