import type { Metadata } from 'next';
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google';
import './globals.css';

const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
});

const display = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow-semi-condensed',
});

export const metadata: Metadata = {
  title: 'Work Trail',
  description: 'Track work. Share updates. Get clear reports.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink-700">{children}</body>
    </html>
  );
}
