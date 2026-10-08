import {
  Armchair,
  Battery,
  Briefcase,
  Circle,
  CircleDot,
  Cog,
  Disc,
  Droplet,
  Droplets,
  Filter,
  Gauge,
  Grip,
  Hand,
  Lamp,
  Link as LinkIcon,
  ScanEye,
  ShieldHalf,
  Snowflake,
  SprayCan,
  Truck,
  Waves,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'
import { GUIDE_DEFAULT_ICON, GUIDE_TYPE_ICON } from '../lib/guide'

// 가이드 글별 주제 아이콘(Community와 같은 Lucide 아이콘). 등록되지 않은 글은 글 유형(PART/CONSUMABLE/DIY) 아이콘을 쓴다.
// DB의 article.emoji는 쓰지 않는다(사이트 전체를 Lucide로 통일).
const GUIDE_SLUG_ICON = {
  muffler: Wind,
  'carrier-topbox': Briefcase,
  mirror: ScanEye,
  seat: Armchair,
  windscreen: ShieldHalf,
  lever: Hand,
  handlebar: Grip,
  wheel: CircleDot,
  lamp: Lamp,
  'handle-damper': Gauge,
  brake: Disc,
  suspension: Waves,
  tire: Circle,
  'chain-sprocket': Cog,
  battery: Battery,
  'engine-oil': Droplet,
  coolant: Snowflake,
  'urea-solution': Truck,
  'brake-fluid': Droplets,
  'chain-lube': SprayCan,
  'air-filter': Filter,
  'spark-plug': Zap,
  'engine-oil-change': Wrench,
  'chain-clean-lube': LinkIcon,
  'brake-pad-check': Disc,
  'air-filter-replace': Filter,
  'tire-pressure-check': Gauge,
  'battery-check': Battery,
}

function GuideIcon({ type, slug, className = '' }) {
  const Component = (slug && GUIDE_SLUG_ICON[slug]) ?? GUIDE_TYPE_ICON[type] ?? GUIDE_DEFAULT_ICON
  return <Component aria-hidden="true" strokeWidth={1.75} className={className} />
}

export default GuideIcon
