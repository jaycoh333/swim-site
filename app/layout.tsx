import type { Metadata } from 'next';
import { VT323, Share_Tech_Mono, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/Navigation';

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
  display: 'swap',
});

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-share-tech',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-ibm-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SWIM — Someone Who Isn\'t Me',
  description: 'An anonymous archive. A hidden network. Someone who isn\'t you was here.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${vt323.variable} ${shareTechMono.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-void text-crt font-mono">
        {/* Grain noise overlay */}
        <div className="noise-overlay" aria-hidden="true" />
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}
