import * as IntentLauncher from 'expo-intent-launcher';
import { getOutbox } from './store';

/** Many Android phones stop background apps to save battery; this opens the page to exempt Work Trail. */
export const openBatterySettings = () =>
  IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
  ).catch(() => undefined);

export const shouldShowBatteryTip = async () =>
  !(await (await getOutbox()).getMeta('batteryTipShown'));

export const dismissBatteryTip = async () =>
  (await getOutbox()).setMeta('batteryTipShown', '1');

/** Brand-specific steps, since each maker hides its background-app switch somewhere different. */
const BRAND_STEPS: Array<{ match: RegExp; brand: string; steps: string }> = [
  {
    match: /samsung/i,
    brand: 'Samsung',
    steps:
      'Settings > Battery > Background usage limits: remove Work Trail from "Sleeping apps" and "Deep sleeping apps". Then open Work Trail in App info > Battery and choose Unrestricted.',
  },
  {
    match: /xiaomi|redmi|poco/i,
    brand: 'Xiaomi / Redmi',
    steps:
      'Settings > Apps > Manage apps > Work Trail: turn on Autostart, then Battery saver > No restrictions.',
  },
  {
    match: /oppo|realme|oneplus/i,
    brand: 'Oppo / Realme',
    steps:
      'Settings > Apps > Work Trail > Battery usage: turn on Allow background activity and Allow auto-launch.',
  },
  {
    match: /vivo|iqoo/i,
    brand: 'Vivo',
    steps:
      'Settings > Battery > Background power consumption > Work Trail: choose Allow high background power consumption. Also turn on Autostart for Work Trail.',
  },
];

export const batteryStepsFor = (manufacturer: string | null | undefined) => {
  const hit = BRAND_STEPS.find((b) => b.match.test(manufacturer ?? ''));
  return hit ? { brand: hit.brand, steps: hit.steps } : null;
};
