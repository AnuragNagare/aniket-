import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AcceptInvitationSchema, type InvitationPreview } from '@worktrail/types';
import { api, ApiError } from '../../api';
import { useAuthStore } from '../../auth/auth-store';
import { extractInviteToken } from '../../auth/invite-token';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, fonts } from '../../theme/theme';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Try again.';

export default function JoinScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const acceptInvite = useAuthStore((s) => s.acceptInvite);
  const [link, setLink] = useState(params.token ?? '');
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'password', string>>>({});
  const [busy, setBusy] = useState(false);

  const lookUp = async () => {
    setError(null);
    const found = extractInviteToken(link);
    if (!found) return setError('Paste the full invite link your admin sent you.');
    setBusy(true);
    try {
      const p = await api.request<InvitationPreview>(
        'GET',
        `/employees/invitations/${found}`,
        undefined,
        { auth: false },
      );
      setToken(found);
      setPreview(p);
      setName(p.employeeName);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setError(null);
    const parsed = AcceptInvitationSchema.safeParse({ name, password });
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      for (const i of parsed.error.issues) next[i.path[0] as 'name' | 'password'] ??= i.message;
      return setFieldErrors(next);
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await acceptInvite(token!, parsed.data.name, parsed.data.password);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Logo />
      {preview ? (
        <>
          <Text style={styles.title}>Join {preview.companyName}</Text>
          <Text style={styles.sub}>
            Set a password for {preview.email}. You&apos;ll use it to sign in to this app.
          </Text>
          <TextField
            label="Your name"
            value={name}
            onChangeText={setName}
            error={fieldErrors.name}
            autoComplete="name"
          />
          <TextField
            label="Create a password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            hint="At least 8 characters"
            secureTextEntry
            autoComplete="new-password"
          />
          {error ? <Notice tone="warning">{error}</Notice> : null}
          <Button title="Join and sign in" loading={busy} onPress={() => void join()} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Join your company</Text>
          <Text style={styles.sub}>
            Your admin sent you an invite link on WhatsApp or email. Paste it here.
          </Text>
          <TextField
            label="Invite link"
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            placeholder="https://…/invite/…"
          />
          {error ? <Notice tone="warning">{error}</Notice> : null}
          <Button title="Continue" loading={busy} onPress={() => void lookUp()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink900, marginTop: 24 },
  sub: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink500 },
});
