import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UPDATE_CATEGORIES, UPDATE_CATEGORY_LABELS, UpdateTextSchema, type UpdateCategory } from '@worktrail/types';
import { ApiError } from '../../api';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { MicButton } from '../../components/MicButton';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { getOutbox } from '../../tracking/store';
import { appendDictated, countLabel } from '../../updates/update-logic';
import { useSendUpdate } from '../../updates/use-send-update';
import { useDictation, type DictationLocale } from '../../voice/use-dictation';
import { colors, fonts, radius } from '../../theme/theme';

export default function UpdateScreen() {
  const router = useRouter();
  const { send, sending } = useSendUpdate();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<UpdateCategory | undefined>();
  const [usedVoice, setUsedVoice] = useState(false);
  const [locale, setLocale] = useState<DictationLocale>('en-IN');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void getOutbox().then((b) => b.getMeta('dictationLocale')).then((v) => {
      if (v === 'hi-IN' || v === 'en-IN') setLocale(v);
    });
  }, []);

  const dictation = useDictation({
    locale,
    onFinal: (spoken) => {
      setUsedVoice(true);
      setText((cur) => {
        const r = appendDictated(cur, spoken);
        if (r.truncated) setNote('You’ve reached 2,000 characters, so the last words weren’t added.');
        return r.text;
      });
    },
  });

  const chooseLocale = (l: DictationLocale) => {
    setLocale(l);
    void getOutbox().then((b) => b.setMeta('dictationLocale', l));
  };

  const submit = async () => {
    if (dictation.state === 'listening') dictation.stop();
    const parsed = UpdateTextSchema.safeParse(text);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setError(null);
    try {
      const result = await send({ text: parsed.data, inputMethod: usedVoice ? 'VOICE' : 'TYPED', category });
      router.replace(`/?note=${result}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <Screen>
      <Text accessibilityRole="link" style={styles.back} onPress={() => router.back()}>Cancel</Text>
      <Text style={styles.title}>Add update</Text>
      <View style={styles.langRow}>
        <Chip label="English" selected={locale === 'en-IN'} onPress={() => chooseLocale('en-IN')} />
        <Chip label="हिन्दी" selected={locale === 'hi-IN'} onPress={() => chooseLocale('hi-IN')} />
      </View>
      <MicButton
        listening={dictation.state === 'listening'}
        disabled={dictation.state === 'unavailable'}
        onPress={() => (dictation.state === 'listening' ? dictation.stop() : void dictation.start())}
      />
      {dictation.interim ? <Text style={styles.interim}>{dictation.interim}</Text> : null}
      {dictation.error ? <Notice tone="warning">{dictation.error}</Notice> : null}
      <TextInput
        accessibilityLabel="Your update"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="What did you do? For example: Completed installation at the client site. One sensor needs replacement."
        placeholderTextColor={colors.ink300}
        style={[styles.box, error ? styles.boxError : null]}
        textAlignVertical="top"
      />
      <View style={styles.metaRow}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <View />}
        <Text style={styles.count}>{countLabel(text)}</Text>
      </View>
      {note ? <Notice>{note}</Notice> : null}
      <Text style={styles.label}>Category (optional)</Text>
      <View style={styles.chips}>
        {UPDATE_CATEGORIES.map((c) => (
          <Chip key={c} label={UPDATE_CATEGORY_LABELS[c]} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
        ))}
      </View>
      <Button title="Send update" loading={sending} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand700 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink900 },
  langRow: { flexDirection: 'row', gap: 8, alignSelf: 'center' },
  interim: { fontFamily: fonts.body, fontSize: 16, color: colors.ink500, fontStyle: 'italic', textAlign: 'center' },
  box: { minHeight: 160, borderRadius: radius.input, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14, fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.ink900 },
  boxError: { borderColor: colors.danger500 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontFamily: fonts.body, fontSize: 14, color: colors.danger500 },
  count: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500 },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink900 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
