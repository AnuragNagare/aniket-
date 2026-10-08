import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PrivacyNotice as PrivacyNoticeType } from '@worktrail/types';
import { Button } from './Button';
import { colors, fonts } from '../theme/theme';

type Props = {
  notice: PrivacyNoticeType;
  onAgree: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function PrivacyNotice({ notice, onAgree, onCancel, loading }: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="privacy-notice-scroll"
    >
      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.retentionNotice}>
        Location data is retained for {notice.retentionDays} days.
      </Text>

      <View style={styles.sections}>
        {notice.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          title="I understand and agree"
          loading={loading}
          onPress={onAgree}
        />
        <Button
          title="Not now"
          variant="secondary"
          onPress={onCancel}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    gap: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink900,
  },
  retentionNotice: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.brand700,
  },
  sections: {
    gap: 16,
  },
  section: {
    gap: 4,
  },
  heading: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink900,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink700,
  },
  actions: {
    gap: 12,
    marginTop: 12,
    paddingBottom: 24,
  },
});
