import { useState } from 'react';
import { Share, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { InviteEmployeeSchema, type InvitationCreated } from '@worktrail/types';
import { useInviteEmployee } from '../../../admin/hooks';
import { inviteMessage } from '../../../admin/invite-message';
import { useCompanyDay } from '../../../admin/use-company';
import { ApiError } from '../../../api/client';
import { Button } from '../../../components/Button';
import { Notice } from '../../../components/Notice';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { colors, fonts } from '../../../theme/theme';

type Field = 'name' | 'email' | 'phone' | 'designation' | 'employeeCode';
type Errors = Partial<Record<Field, string>>;

export default function InviteScreen() {
  const router = useRouter();
  const { companyName } = useCompanyDay();
  const invite = useInviteEmployee();
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', phone: '', designation: '', employeeCode: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ result: InvitationCreated; name: string } | null>(null);
  const set = (k: Field) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setFormError(null);
    const parsed = InviteEmployeeSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as Field] ??= i.message;
      return setErrors(next);
    }
    setErrors({});
    try {
      setCreated({ result: await invite.mutateAsync(parsed.data), name: parsed.data.name });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  if (created) {
    const { result, name } = created;
    return (
      <Screen>
        <Text style={styles.title}>Invite created for {name}</Text>
        <Text style={styles.sub}>The link works once and expires in 7 days.</Text>
        {result.emailSent ? (
          <Notice>We emailed the link too.</Notice>
        ) : (
          <Notice tone="warning">The invite could not be emailed. Share the link with {name} yourself, for example on WhatsApp.</Notice>
        )}
        <Button title="Share link" onPress={() => void Share.share({ message: inviteMessage(companyName, name, result.inviteUrl) })} />
        <Button title="Done" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Invite an employee</Text>
      <Text style={styles.sub}>They open the link in the Work Trail app, choose Get started, and set a password.</Text>
      <TextField label="Name" value={values.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
      <TextField
        label="Email address"
        value={values.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        hint="They sign in with this email"
      />
      <TextField label="Mobile number (optional)" value={values.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" />
      <TextField label="Designation (optional)" value={values.designation} onChangeText={set('designation')} error={errors.designation} />
      <TextField label="Employee ID (optional)" value={values.employeeCode} onChangeText={set('employeeCode')} error={errors.employeeCode} />
      {formError ? <Notice tone="warning">{formError}</Notice> : null}
      <Button title="Create invite" loading={invite.isPending} onPress={() => void submit()} />
      <Text accessibilityRole="link" style={styles.link} onPress={() => router.back()}>
        Cancel
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500 },
  link: { fontFamily: fonts.semibold, color: colors.brand700, fontSize: 16, textAlign: 'center', padding: 8 },
});
