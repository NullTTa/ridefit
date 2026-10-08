// 단어 끝 글자의 받침에 맞춰 조사를 붙인다(예: josa('휠', '이', '가') -> '휠이', josa('머플러', '이', '가') -> '머플러가').
// 끝의 따옴표와 괄호 설명은 읽지 않으므로 그 앞 단어로 판단한다('마차 휠 (21~25년식)' -> '휠'의 받침).
// 끝 글자가 한글이 아니면(영문/숫자) 발음을 알 수 없어 '이(가)'처럼 두 형태를 함께 쓴다.
export function josa(word, withFinal, withoutFinal) {
  const text = String(word ?? '')
  const base = text.replace(/['"]+$/, '').replace(/\s*\([^()]*\)\s*$/, '').trim()
  const code = base.charCodeAt(base.length - 1) - 0xac00
  if (!(code >= 0 && code <= 11171)) return `${text}${withFinal}(${withoutFinal})`
  const final = code % 28
  // '(으)로'는 받침이 없거나 ㄹ받침이면 '로'
  if (withFinal === '으로') return `${text}${final === 0 || final === 8 ? '로' : '으로'}`
  return `${text}${final ? withFinal : withoutFinal}`
}
