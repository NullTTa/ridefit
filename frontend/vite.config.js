import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 메인 개발/시연 주소는 항상 http://localhost:5173 (카카오 지도 JavaScript 키에 등록된 도메인).
    // 5173이 이미 사용 중이면 Vite는 기본적으로 5174 등 다른 포트로 조용히 옮겨 가는데, 그러면 지도가
    // "domain mismatched"로 안 뜨므로 옮겨 가지 않고 실행을 멈춘다(5174는 테스트용 설정에서 따로 띄운다).
    port: 5173,
    strictPort: true,
    // 서버에 저장된 이미지(부품 대표 이미지/AI 장착 결과 등, "/uploads/...")를 개발 서버에서도
    // 같은 경로로 보이게 한다. 기존 /assets/... 정적 이미지와 똑같이 <img src="/uploads/..."> 로 쓸 수 있다.
    proxy: {
      '/uploads': 'http://localhost:8080',
    },
  },
})
