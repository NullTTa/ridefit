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
      keyframes: {
        'label-cycle': {
          '0%, 100%': { opacity: 0, transform: 'translateY(4px)' },
          '5%': { opacity: 1, transform: 'translateY(0)' },
          '15%': { opacity: 1, transform: 'translateY(0)' },
          '22%': { opacity: 0, transform: 'translateY(4px)' },
        },
        'hotspot-glow': {
          '0%, 100%': { opacity: 0, boxShadow: '0 0 0 rgba(59,130,246,0)' },
          '5%': { opacity: 1, boxShadow: '0 0 16px 4px rgba(59,130,246,0.7)' },
          '15%': { opacity: 1, boxShadow: '0 0 16px 4px rgba(59,130,246,0.7)' },
          '22%': { opacity: 0, boxShadow: '0 0 0 rgba(59,130,246,0)' },
        },
        'vehicle-pulse': {
          '0%, 100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(59,130,246,0))' },
          '50%': { transform: 'scale(1.02)', filter: 'drop-shadow(0 0 26px rgba(59,130,246,0.35))' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      animation: {
        'label-cycle': 'label-cycle 8s ease-in-out infinite',
        'hotspot-glow': 'hotspot-glow 8s ease-in-out infinite',
        'vehicle-pulse': 'vehicle-pulse 4s ease-in-out infinite',
        fadeIn: 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
