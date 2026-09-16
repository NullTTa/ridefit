/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ridefit-primary': '#FF6B35',
        'ridefit-bg-light': '#FFFFFF',
        'ridefit-bg-light-alt': '#F9FAFB',
        'ridefit-text-light': '#111827',
        'ridefit-bg-dark': '#111827',
        'ridefit-bg-dark-alt': '#030712',
        'ridefit-text-dark': '#F9FAFB',
      },
    },
  },
  plugins: [],
}
