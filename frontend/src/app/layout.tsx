import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Providers from './Providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://denkenai.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    template: '%s | DenkenAI',
    default: 'DenkenAI — Academic Performance Intelligence',
  },
  description:
    'AI-powered adaptive learning platform for JEE, NEET, and CBSE students. ' +
    'Personalised tests, AI mentor, mastery tracking, and exam roadmaps.',
  applicationName: 'DenkenAI',
  keywords: [
    'JEE preparation', 'NEET preparation', 'CBSE preparation',
    'AI learning', 'adaptive tests', 'academic performance',
    'exam coaching', 'AI mentor',
  ],
  authors: [{ name: 'DenkenAI', url: APP_URL }],
  openGraph: {
    type: 'website',
    siteName: 'DenkenAI',
    title: 'DenkenAI — Academic Performance Intelligence',
    description:
      'AI-powered adaptive learning platform for JEE, NEET, and CBSE students.',
    url: APP_URL,
    images: [
      {
        url: '/Dashboard_Preview.png',
        width: 1200,
        height: 630,
        alt: 'DenkenAI — AI-powered exam preparation platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DenkenAI — Academic Performance Intelligence',
    description:
      'AI-powered adaptive learning platform for JEE, NEET, and CBSE students.',
    images: ['/Dashboard_Preview.png'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8762F7' },
    { media: '(prefers-color-scheme: dark)',  color: '#8762F7' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full bg-dark-bg text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
