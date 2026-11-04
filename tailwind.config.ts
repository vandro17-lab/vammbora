import type { Config } from 'tailwindcss';

/**
 * Design System Vambora — tokens centrais.
 * Paleta: azul-marinho profundo (brand), verde-menta (accent),
 * branco, cinzas neutros e acentos discretos. Sem aparência de template.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1200px',
      },
    },
    extend: {
      colors: {
        // Azul-marinho profundo (cor-mãe da marca)
        navy: {
          50: '#eef3fb',
          100: '#d6e2f4',
          200: '#adc3e7',
          300: '#7c9cd6',
          400: '#4f72bf',
          500: '#2f52a0',
          600: '#213d7d',
          700: '#182e60',
          800: '#102044',
          900: '#0b1f3a',
          950: '#07132a',
        },
        // Verde-menta (acento vivo, confiança/avançar)
        mint: {
          50: '#edfbf5',
          100: '#d2f5e6',
          200: '#a8eccf',
          300: '#71dcb3',
          400: '#3cc394',
          500: '#1ba67a',
          600: '#128563',
          700: '#116a51',
          800: '#115442',
          900: '#0f4538',
        },
        // Âmbar discreto para avisos/pendências
        amber: {
          50: '#fff8ed',
          100: '#fdecc8',
          200: '#fad79a',
          300: '#f6bd60',
          400: '#f0a033',
          500: '#dd8514',
          600: '#b9660f',
          700: '#944c11',
          800: '#793d14',
          900: '#663414',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,58,0.04), 0 8px 24px -12px rgba(11,31,58,0.18)',
        'card-hover': '0 2px 4px rgba(11,31,58,0.06), 0 18px 40px -16px rgba(11,31,58,0.28)',
        float: '0 24px 60px -20px rgba(11,31,58,0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
