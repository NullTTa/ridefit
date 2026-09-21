import { useEffect, useRef, useState } from 'react'

const SDK_SCRIPT_ID = 'kakao-maps-sdk'

// Kakao Maps JavaScript SDK를 한 번만 로드하고, 이미 로드돼 있으면 재사용한다.
// autoload=false로 받아온 뒤 kakao.maps.load(콜백)로 지도 라이브러리 초기화가 끝난 시점을 기다린다.
//
// 키가 있어도 다음 이유로 정상 스크립트 대신 에러 JSON이 내려올 수 있다: 앱에 "지도" 제품이
// 비활성화됨, 도메인이 등록 안 됨, 키가 잘못됨 등. 이 경우 <script>는 "로드는 됐지만"
// window.kakao.maps가 없는 상태이므로, 그대로 .maps.load()를 부르면 예외가 나서 Promise가
// 영원히 멈춘다(fallback도 못 뜸) - 그래서 항상 존재를 먼저 확인하고 없으면 명시적으로 reject한다.
function onKakaoScriptLoaded(resolve, reject) {
  if (window.kakao?.maps) {
    try {
      window.kakao.maps.load(() => resolve(window.kakao))
    } catch {
      reject(new Error('Kakao Maps SDK 초기화 실패'))
    }
  } else {
    reject(new Error('Kakao Maps SDK 응답이 올바르지 않습니다(키/도메인/서비스 활성화 상태를 확인하세요)'))
  }
}

function loadKakaoMaps(appKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve(window.kakao)
      return
    }

    const existing = document.getElementById(SDK_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => onKakaoScriptLoaded(resolve, reject))
      existing.addEventListener('error', () => reject(new Error('Kakao Maps SDK 로드 실패')))
      return
    }

    const script = document.createElement('script')
    script.id = SDK_SCRIPT_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => onKakaoScriptLoaded(resolve, reject)
    script.onerror = () => reject(new Error('Kakao Maps SDK 로드 실패'))
    document.head.appendChild(script)
  })
}

// 정비·세차 서비스 매장 지도. 키가 없거나 SDK 로드에 실패해도 이 영역만 안내 문구로 대체되고
// 나머지 화면(목록/상세/가상 예약)은 그대로 동작한다.
function KakaoServiceMap({ shops, selectedShopId, onSelectShop, className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_KEY
    if (!appKey) {
      setStatus('error')
      return
    }

    let cancelled = false
    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return
        const center = new kakao.maps.LatLng(37.4785, 126.7205) // 8개 매장 권역(인천/부천)의 대략적 중심
        mapRef.current = new kakao.maps.Map(containerRef.current, { center, level: 8 })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    const kakao = window.kakao

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    const bounds = new kakao.maps.LatLngBounds()
    let hasPosition = false

    shops.forEach((shop) => {
      if (shop.lat == null || shop.lng == null) return
      const position = new kakao.maps.LatLng(shop.lat, shop.lng)
      const marker = new kakao.maps.Marker({ position, map: mapRef.current, title: shop.name })
      kakao.maps.event.addListener(marker, 'click', () => onSelectShop?.(shop))
      markersRef.current.push(marker)
      bounds.extend(position)
      hasPosition = true
    })

    if (hasPosition) mapRef.current.setBounds(bounds)
  }, [status, shops, onSelectShop])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || selectedShopId == null) return
    const shop = shops.find((s) => s.id === selectedShopId)
    if (shop?.lat != null && shop?.lng != null) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(shop.lat, shop.lng))
    }
  }, [status, selectedShopId, shops])

  if (status === 'error') {
    return (
      <div
        className={`flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-ridefit-border bg-ridefit-card px-6 text-center text-sm text-ridefit-text-secondary ${className}`}
      >
        지도를 불러올 수 없습니다. 아래 서비스 목록에서 매장을 확인해주세요.
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-ridefit-border ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ridefit-card text-sm text-ridefit-text-secondary">
          지도를 불러오는 중...
        </div>
      )}
      <div ref={containerRef} className="h-full min-h-[280px] w-full" />
    </div>
  )
}

export default KakaoServiceMap
