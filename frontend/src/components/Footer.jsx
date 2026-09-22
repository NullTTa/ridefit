import { RIDEFIT_LOGO_IMAGE } from '../constants/images'

function Footer() {
  return (
    <footer className="mt-auto border-t border-ridefit-border bg-ridefit-bg-alt">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-sm text-ridefit-text-secondary sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <img src={RIDEFIT_LOGO_IMAGE} alt="RIDEFIT" className="h-8 w-auto" />
          <span>© 2026</span>
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
