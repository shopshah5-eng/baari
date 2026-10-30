/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5746F5',
          hover: '#4736E5',
          light: '#EEF0FF'
        },
        dark: '#111827',
        'bg-base': '#FFFFFF',
        'bg-inset': '#F8FAFC',
        border: '#E5E7EB',
        success: {
          DEFAULT: '#16A34A',
          light: '#F0FDF4'
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEFCE8'
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2'
        },
        muted: '#6B7280'
      },
      borderRadius: {
        input: '8px',
        card: '12px',
        pill: '999px'
      },
      boxShadow: {
        minimal: '0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)'
      }
    }
  },
  plugins: []
};

