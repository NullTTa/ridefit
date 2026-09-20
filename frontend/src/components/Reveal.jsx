import { useEffect, useRef, useState } from 'react'

// 스크롤로 화면에 들어올 때 한 번만 살짝 떠오르며 나타나는 래퍼. (index.css의 .reveal)
// IntersectionObserver를 쓸 수 없거나 모션 감소 설정이면 처음부터 보이도록 한다.
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { '--reveal-delay': `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  )
}

export default Reveal
