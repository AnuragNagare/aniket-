import { redirect } from 'next/navigation';

// No marketing page is designed yet; the admin app starts at sign-in.
export default function Home() {
  redirect('/login');
}
