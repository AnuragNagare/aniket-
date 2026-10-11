import { StyleSheet, Text, View } from 'react-native';
import { AI_LABEL, UPDATE_CATEGORY_LABELS, type UpdateCategory } from '@worktrail/types';
import { dateTimeIn } from '../../admin/format';
import { colors, fonts, radius } from '../../theme/theme';

type Props = {
  who?: string;
  text: string;
  submittedAt: string;
  timezone: string;
  category: UpdateCategory | null;
  voice: boolean;
  /** Short AI summary when one is ready; the raw text is always shown. */
  summary: string | null;
};

/** One work update: the raw text first, the AI summary (labelled) underneath. */
export function UpdateItem({ who, text, submittedAt, timezone, category, voice, summary }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.meta}>
        {who ? `${who} · ` : ''}
        {dateTimeIn(submittedAt, timezone)}
        {category ? ` · ${UPDATE_CATEGORY_LABELS[category]}` : ''}
        {voice ? ' · Voice' : ''}
      </Text>
      <Text style={styles.text}>{text}</Text>
      {summary ? (
        <View style={styles.ai} accessibilityLabel={`${AI_LABEL} ${summary}`}>
          <Text style={styles.aiTag}>AI summary</Text>
          <Text style={styles.aiText}>{summary}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink500 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink900 },
  ai: { backgroundColor: colors.brand50, borderRadius: radius.input, padding: 10, gap: 2 },
  aiTag: { fontFamily: fonts.semibold, fontSize: 12, color: colors.brand700 },
  aiText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink700 },
});
