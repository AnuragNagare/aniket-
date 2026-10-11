import { Tabs } from 'expo-router';
import { colors, fonts } from '../../theme/theme';

/** The admin area: four tabs. Only owners and admins reach this (see the guard in the root layout). */
export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.ink500,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 14 },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 56 },
        tabBarLabelPosition: 'beside-icon',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="employees" options={{ title: 'Employees' }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
