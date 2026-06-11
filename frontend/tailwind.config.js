/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional del módulo
        ink: '#1B2733',
        paper: '#F7F8FA',
        primary: { DEFAULT: '#1E5AA8', dark: '#15457F', light: '#E8F0FB' },
        risk: { low: '#2E9E6B', mid: '#E5A33D', high: '#D14545' },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
