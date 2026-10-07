import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InviteDeepLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={{ pathname: '/join', params: { token } }} />;
}
