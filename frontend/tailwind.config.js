/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 라이트 + 그린 브랜드 테마. 로고 오렌지 포인트는 유지, 나머지는 전부 이 토큰만 사용한다.
        'ridefit-logo': '#FF6B35',
        'ridefit-primary': '#16A34A',
        'ridefit-accent': '#16A34A',
        'ridefit-bg': '#F6F8F6',
        'ridefit-bg-alt': '#EEF3EE',
        'ridefit-card': '#FFFFFF',
        'ridefit-border': '#DEE5DE',
        'ridefit-text': '#1C2620',
        'ridefit-text-secondary': '#68746C',
        // 상태 색상: 호환가능(초록) / 주의(주황) / 불가능(빨강) — 카드형·텍스트형 어디서나 이 토큰만 쓴다.
        'ridefit-success': '#16A34A',
        'ridefit-success-bg': '#EAF6EC',
        'ridefit-success-border': '#BFE3C6',
        'ridefit-warning': '#B45309',
        'ridefit-warning-bg': '#FDF3E3',
        'ridefit-warning-border': '#F0D9A8',
        'ridefit-danger': '#DC2626',
        'ridefit-danger-bg': '#FCEBEB',
        'ridefit-danger-border': '#F3C6C6',
      },
      keyframes: {
        'label-cycle': {
          '0%, 100%': { opacity: 0, transform: 'translateY(4px)' },
          '5%': { opacity: 1, transform: 'translateY(0)' },
          '15%': { opacity: 1, transform: 'translateY(0)' },
          '22%': { opacity: 0, transform: 'translateY(4px)' },
        },
        'hotspot-glow': {
          '0%, 100%': { opacity: 0, boxShadow: '0 0 0 rgba(22,163,74,0)' },
          '5%': { opacity: 1, boxShadow: '0 0 16px 4px rgba(22,163,74,0.55)' },
          '15%': { opacity: 1, boxShadow: '0 0 16px 4px rgba(22,163,74,0.55)' },
          '22%': { opacity: 0, boxShadow: '0 0 0 rgba(22,163,74,0)' },
        },
        'vehicle-pulse': {
          '0%, 100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(22,163,74,0))' },
          '50%': { transform: 'scale(1.02)', filter: 'drop-shadow(0 0 22px rgba(22,163,74,0.3))' },
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
