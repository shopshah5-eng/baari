import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Baari — Your front desk, on autopilot',
  description: 'WhatsApp-first appointment queue and front-office automation for clinics, labs, and salons.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-inset text-dark antialiased">
        {children}
      </body>
    </html>
  );
}

