import { BookOpen, Droplet, Package, Wrench } from 'lucide-react'
import { api } from './api'

// 부품 카테고리(예: "머플러")와 부품 정보 글(slug)의 연결표. 한 번만 받아서 재사용한다.
let categorySlugPromise = null

export function loadPartCategorySlugs() {
  if (!categorySlugPromise) {
    categorySlugPromise = api
      .get('/api/guide/articles?type=PART', { auth: false })
      .then((articles) =>
        Object.fromEntries(articles.filter((a) => a.partCategory).map((a) => [a.partCategory, a.slug])),
      )
      .catch(() => {
        categorySlugPromise = null
        return {}
      })
  }
  return categorySlugPromise
}

// 가이드 글 유형별 아이콘(DB의 article.emoji 대신 - 화면에서 이모지를 쓰지 않는다)
export const GUIDE_TYPE_ICON = {
  PART: Package,
  CONSUMABLE: Droplet,
  DIY: Wrench,
}
export const GUIDE_DEFAULT_ICON = BookOpen

export const GUIDE_TYPE_LABEL = { PART: '부품 정보', CONSUMABLE: '소모품 정보', DIY: 'DIY 가이드' }
export const APPLIES_LABEL = { MOTORCYCLE: '오토바이', CAR: '자동차' }

export function formatAppliesTo(appliesTo) {
  if (!appliesTo) return []
  return appliesTo.split(',').map((v) => APPLIES_LABEL[v.trim()] ?? v.trim())
}
