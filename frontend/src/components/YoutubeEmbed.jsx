function extractYoutubeId(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1)
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/embed/')[1]
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/shorts/')[1]
    }
    return null
  } catch {
    return null
  }
}

// 유튜브 링크를 임베드 플레이어로 보여준다. 유튜브가 아니거나 형식을 못 알아보면 링크만 보여준다.
function YoutubeEmbed({ url, title = '관련 영상' }) {
  const videoId = extractYoutubeId(url)

  if (!videoId) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-ridefit-primary hover:underline">
        영상 링크 열기
      </a>
    )
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-ridefit-border">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

export default YoutubeEmbed
