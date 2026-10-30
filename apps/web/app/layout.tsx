import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Baari — Your front desk, on autopilot',
  description: 'Aapki baari, WhatsApp par. Intelligent front-office queue automation for clinics, labs, and salons.',
  metadataBase: new URL('https://baari-inky.vercel.app'),
  openGraph: {
    title: 'Baari — Your front desk, on autopilot',
    description: 'Aapki baari, WhatsApp par.',
    url: 'https://baari-inky.vercel.app',
    siteName: 'Baari',
    locale: 'hi_IN',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-bg-inset text-dark antialiased focus-visible:outline-primary`}>
        {children}
      </body>
    </html>
  );
}
