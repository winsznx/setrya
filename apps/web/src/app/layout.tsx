import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, JetBrains_Mono, Newsreader } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import './globals.css';

const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-hanken', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-newsreader', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Setrya', template: '%s · Setrya' },
  description: 'Settle revenue-sharing obligations privately, with a clear statement for every partner. Revenue sharing and shielded ZEC settlement for small crypto-native businesses.',
  applicationName: 'Setrya',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eceef1' },
    { media: '(prefers-color-scheme: dark)', color: '#08090b' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get('setrya_theme')?.value;
  return (
    <html lang="en" data-theme={theme === 'light' || theme === 'dark' ? theme : undefined} className={`${hanken.variable} ${newsreader.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
