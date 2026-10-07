import * as Location from 'expo-location';

export const TASK_NAME = 'worktrail-location';
export const INTERVAL_MS = 5 * 60_000;

export const TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: INTERVAL_MS,
  distanceInterval: 0,
  deferredUpdatesInterval: INTERVAL_MS,
  pausesUpdatesAutomatically: false,
  foregroundService: {
    notificationTitle: 'Work Trail: you’re at work',
    notificationBody: 'Your location is shared every 5 minutes until you tap End work.',
    notificationColor: '#FE5A0C',
    killServiceOnDestroy: false,
  },
};
