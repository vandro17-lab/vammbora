import type { Config } from 'tailwindcss';

/**
 * Design System Vambora — tokens centrais (premium).
 * Paleta: azul-marinho profundo (brand), verde-menta (accent),
 * branco, cinzas neutros e acentos discretos. Sem aparência de template.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1240px',
      },
    },
    extend: {
      colors: {
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
      letterSpacing: {
        tightest: '-0.03em',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      transitionTimingFunction: {
        // Easings premium (suave de entrada, firme de saída)
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
        'premium-in': 'cubic-bezier(0.64, 0, 0.78, 0)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,58,0.04), 0 10px 30px -14px rgba(11,31,58,0.22)',
        'card-hover':
          '0 2px 6px rgba(11,31,58,0.06), 0 26px 50px -18px rgba(11,31,58,0.34)',
        float: '0 30px 70px -24px rgba(11,31,58,0.4)',
        glow: '0 0 0 1px rgba(60,195,148,0.35), 0 12px 40px -8px rgba(27,166,122,0.45)',
        'inner-top': 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
      },
      keyframes: {
        'reveal-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.985)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'aurora-a': {
          '0%,100%': { transform: 'translate3d(-6%, -4%, 0) scale(1)' },
          '50%': { transform: 'translate3d(8%, 6%, 0) scale(1.18)' },
        },
        'aurora-b': {
          '0%,100%': { transform: 'translate3d(6%, 5%, 0) scale(1.1)' },
          '50%': { transform: 'translate3d(-8%, -6%, 0) scale(0.92)' },
        },
        'road-scroll': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '-240px 0' },
        },
        'wheel-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'float-soft': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'sheen': {
          '0%': { transform: 'translateX(-130%) skewX(-18deg)' },
          '60%,100%': { transform: 'translateX(230%) skewX(-18deg)' },
        },
      },
      animation: {
        'reveal-in': 'reveal-in 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'aurora-a': 'aurora-a 16s ease-in-out infinite',
        'aurora-b': 'aurora-b 20s ease-in-out infinite',
        'road-scroll': 'road-scroll 0.6s linear infinite',
        'wheel-spin': 'wheel-spin 0.9s linear infinite',
        'float-soft': 'float-soft 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
