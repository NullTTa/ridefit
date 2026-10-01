// 해외 판매처에서 가져온 상품명에 일본어(가나)/중국어(한자)가 섞여 있는지 확인한다.
// 자동 번역은 하지 않는다 - 등록하는 사람이 한국어 상품명으로 직접 고쳐 쓰도록 경고만 띄운다.
const FOREIGN_TEXT = /[\u3040-\u30ff\uff66-\uff9f\u3400-\u4dbf\u4e00-\u9fff]/

export function hasForeignText(text) {
  return typeof text === 'string' && FOREIGN_TEXT.test(text)
}

export const FOREIGN_TEXT_WARNING =
  '일본어/중국어 문자가 포함되어 있어요. 사용자 화면에 그대로 보이니 한국어 상품명으로 바꿔 입력해주세요(원문은 상품 링크에서 확인할 수 있어요).'
