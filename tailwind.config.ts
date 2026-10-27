import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { primary: { DEFAULT: '#4f46e5', hover: '#4338ca' } }, fontFamily: { sans: ['Inter', 'sans-serif'] } } },
  plugins: [],
} satisfies Config;
