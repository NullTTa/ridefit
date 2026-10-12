import { useState } from 'react'
import { canSaveFitComposite, compositeIncludedParts, saveFitComposite } from './fitComposite'

// FitRoom [현재 모습 저장] 상태(components/FitSavePanel의 FitSaveAction·FitSavedList가 같이 쓴다).
// onSaved(result, includedParts): 저장 직후(같은 조합이면 서버가 기존 결과를 돌려준다 - cached).
export function useFitSave({ vehicle, myVehicleId, activeParts, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null) // { kind: 'error' | 'info', text }
  const canSave = canSaveFitComposite(vehicle, activeParts)
  const included = canSave ? compositeIncludedParts(vehicle, activeParts) : []
  const excluded = activeParts.filter((p) => !included.some((x) => x.partId === p.partId))
  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      const { result, includedParts } = await saveFitComposite(vehicle, myVehicleId, activeParts)
      setNote(result.cached ? { kind: 'info', text: '같은 조합으로 이미 저장한 모습이 있어서 그 결과를 열었어요.' } : null)
      onSaved(result, includedParts)
    } catch (err) {
      setNote({ kind: 'error', text: (err.message ?? '저장하지 못했어요.').replace(/AI\s?/g, '') })
    } finally {
      setSaving(false)
    }
  }
  return { canSave, included, excluded, saving, note, save, hasParts: activeParts.length > 0 }
}
