import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Baari — Your front desk, on autopilot';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          backgroundImage: 'radial-gradient(circle at 50% 30%, #EEF2FF 0%, #FFFFFF 70%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            backgroundColor: '#5746F5',
            color: '#FFFFFF',
            fontSize: 54,
            fontWeight: 800,
            marginBottom: 24,
            boxShadow: '0 20px 25px -5px rgba(87, 70, 245, 0.3)',
          }}
        >
          ब
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#111827',
            letterSpacing: '-0.03em',
            marginBottom: 12,
          }}
        >
          Baari
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: '#5746F5',
            marginBottom: 16,
          }}
        >
          Aapki baari, WhatsApp par
        </div>

        <div
          style={{
            fontSize: 20,
            color: '#6B7280',
            maxWidth: 600,
            textAlign: 'center',
          }}
        >
          Intelligent front-office queue automation for clinics, labs, and salons.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

