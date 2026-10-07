import type { QualityFlag } from '@prisma/client';

const MAX_GOOD_ACCURACY_M = 100;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

/** Flags doubtful points instead of dropping them (PRD: "do not overstate accuracy"). */
export function qualityFor(
  accuracyMeters: number | null | undefined,
  capturedAt: Date,
  now = new Date(),
): QualityFlag {
  if (capturedAt.getTime() - now.getTime() > MAX_FUTURE_SKEW_MS) return 'SUSPICIOUS';
  if (accuracyMeters == null || accuracyMeters > MAX_GOOD_ACCURACY_M) return 'LOW_ACCURACY';
  return 'GOOD';
}
