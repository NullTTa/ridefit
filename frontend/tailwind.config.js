/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // RIDEFIT 로고만 오렌지 포인트를 유지하고, 나머지는 전부 블루블랙 톤으로 통일한다.
        'ridefit-logo': '#FF6B35',
        'ridefit-primary': '#3B82F6',
        'ridefit-accent': '#3B82F6',
        'ridefit-bg': '#0B0E14',
        'ridefit-bg-alt': '#070A0F',
        'ridefit-card': '#131824',
        'ridefit-border': '#232B3A',
        'ridefit-text': '#E7ECF3',
        'ridefit-text-secondary': '#8B95A8',
      },
    },
  },
  plugins: [],
}
