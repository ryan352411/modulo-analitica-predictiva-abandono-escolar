/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional — "Índigo & Teal" (confianza serena)
        ink: '#1E2A38',
        paper: '#F5F7FA',
        primary: { DEFAULT: '#3E5C9A', dark: '#2C4576', light: '#EAEFF9' },
        accent: { DEFAULT: '#2C9D8F', dark: '#218475', light: '#E3F4F1' },
        risk: { low: '#3E9E6E', mid: '#E0A13B', high: '#D2604F', critical: '#8E2F2F' },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
