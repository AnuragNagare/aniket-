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
