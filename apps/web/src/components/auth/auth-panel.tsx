import Image from 'next/image';
import { BarChart3, MapPin, MessageSquareText } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

const FEATURES = [
  { icon: MapPin, title: 'Track field teams', body: 'Know where your team works' },
  { icon: MessageSquareText, title: 'Get real updates', body: 'Text or voice updates from the field' },
  { icon: BarChart3, title: 'Clear reports', body: 'Daily, weekly and monthly PDFs' },
];

const COPY = {
  signup: {
    headline: (
      <>
        Track work.
        <br />
        Get real
        <br />
        <span className="text-brand-500">visibility.</span>
      </>
    ),
    body: 'Manage your field team, track work sessions, view locations and get clear reports, all in one place.',
  },
  login: {
    headline: (
      <>
        Welcome
        <br />
        <span className="text-brand-500">back!</span>
      </>
    ),
    body: 'Sign in to manage your team, track work and generate reports.',
  },
  join: {
    headline: (
      <>
        Welcome to
        <br />
        <span className="text-brand-500">Work Trail.</span>
      </>
    ),
    body: 'Start work, share updates from the field and keep a clear record of your day.',
  },
} as const;

type Variant = keyof typeof COPY;

/** Left half of the auth card: brand, headline and illustration (collapses on small screens). */
export function AuthPanel({ variant }: { variant: Variant }) {
  const signup = variant === 'signup';
  return (
    <aside className="relative flex flex-col overflow-hidden bg-auth-panel p-8 max-[900px]:p-6">
      <Logo />
      <div className="mt-12 max-[900px]:hidden">
        <p className="font-display text-[40px] font-bold leading-[1.08] text-ink-900">
          {COPY[variant].headline}
        </p>
        <p className="mt-4 max-w-[32ch] text-[15px] leading-relaxed text-ink-700">
          {COPY[variant].body}
        </p>
      </div>

      <div className="mt-auto pt-6 max-[900px]:hidden">
        <Image
          src={signup ? '/illustrations/auth-signup.png' : '/illustrations/auth-login.png'}
          alt=""
          width={signup ? 214 : 205}
          height={signup ? 270 : 375}
          priority
          className="-mx-8 h-[300px] w-[calc(100%+4rem)] max-w-none object-cover [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_78%,transparent)]"
        />
        {signup ? (
          <ul className="relative -mt-14 space-y-2.5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex items-center gap-3 rounded-input bg-surface/95 p-3 shadow-card backdrop-blur"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-500 text-white">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{title}</span>
                  <span className="block text-xs text-ink-500">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
