import type { Config } from 'tailwindcss';

/**
 * Paleta consolidada en 4 familias + semánticos, tal como quedó tras la
 * unificación de 2026-06-11 (de 40 tokens a 27). Los secundarios NO son grises:
 * son navy con opacidad.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#F6F4EF', // off-white neutro: delta R-B = 7, clave para que no lea "tan"
          2: '#EDE9DF',
          cream: '#FBF1E1', // tint cálido para chips y selectores
        },
        ink: '#1F2937',
        navy: {
          DEFAULT: '#1B3C59',
          deep: '#16314a',
        },
        accent: {
          DEFAULT: '#E07A3C', // coral cálido — único color de CTA
          dark: '#C5631F',
          light: '#E8A87C',
          hover: '#d8723a',
        },
        gold: '#F2C13F', // solo estrellas
        line: '#E8E3D6', // único tono de borde
        whatsapp: '#25D366',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,60,89,0.04), 0 6px 16px -8px rgba(27,60,89,0.08)',
        'card-hover': '0 2px 4px rgba(27,60,89,0.05), 0 18px 40px -16px rgba(27,60,89,0.22)',
        panel:
          'inset 0 1px 0 rgba(255,255,255,.8), 0 2px 6px rgba(27,60,89,.05), 0 30px 60px -30px rgba(27,60,89,.25)',
        accent:
          'inset 0 1px 0 rgba(255,255,255,.18), 0 1px 2px rgba(197,99,31,.4), 0 10px 24px -8px rgba(224,122,60,.55)',
        'accent-hover':
          'inset 0 1px 0 rgba(255,255,255,.22), 0 2px 4px rgba(197,99,31,.4), 0 18px 36px -10px rgba(224,122,60,.6)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        cardIn: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        cartPop: { '0%': { transform: 'scale(1)' }, '30%': { transform: 'scale(1.4)' }, '100%': { transform: 'scale(1)' } },
        blobFloat: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(30px,-20px) scale(1.08)' },
        },
        floatY: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        skeleton: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: {
        'fade-in': 'fadeIn .3s ease-in-out',
        'card-in': 'cardIn .5s ease both',
        'cart-pop': 'cartPop .45s ease',
        blob: 'blobFloat 16s ease-in-out infinite',
        'blob-slow': 'blobFloat 20s ease-in-out infinite reverse',
        'float-y': 'floatY 6s ease-in-out infinite',
        skeleton: 'skeleton 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
