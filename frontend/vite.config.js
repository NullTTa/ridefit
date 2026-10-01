import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 서버에 저장된 이미지(부품 대표 이미지/AI 장착 결과 등, "/uploads/...")를 개발 서버에서도
    // 같은 경로로 보이게 한다. 기존 /assets/... 정적 이미지와 똑같이 <img src="/uploads/..."> 로 쓸 수 있다.
    proxy: {
      '/uploads': 'http://localhost:8080',
    },
  },
})
