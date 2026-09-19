function Footer() {
  return (
    <footer className="mt-auto border-t border-ridefit-border bg-ridefit-bg-alt">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-sm text-ridefit-text-secondary sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ridefit-accent text-xs font-bold text-white">
            RF
          </span>
          <span>© 2026 RIDEFIT</span>
        </div>

        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <p>내 차량에 맞는 부품을 찾고, 장착하기 전에 확인하세요</p>
          <a
            href="https://github.com/NullTTa/ridefit"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-ridefit-primary hover:underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
