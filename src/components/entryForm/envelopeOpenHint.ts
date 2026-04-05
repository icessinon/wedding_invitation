export const ENVELOPE_OPEN_HINT_FIXED = 'タップしてお手紙をご覧ください'

const MAX_LETTER_BODY_LEN = 2000
const MAX_LETTER_CODE_DIGITS = 12

export type GuestLetterByCode = {
  letter?: string
  letterAttend?: string
  letterAbsent?: string
}

export const GUEST_LETTER_BY_CODE: Record<string, GuestLetterByCode> = {
  '1': {
    letterAttend: 'あなた向けの出席メッセージ\n2行目',
  },
}

export type LetterUrlHints = {
  urlAttend: boolean
  letterCode: string | null
  urlLetter: string | null
  urlLetterAttend: string | null
  urlLetterAbsent: string | null
}

export function parseLetterUrlHints(search: string): LetterUrlHints {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const a = sp.get('attendance')?.toLowerCase().trim()
  const r = sp.get('rsvp')?.toLowerCase().trim()
  const rawCode = (sp.get('e') ?? sp.get('code') ?? '').trim()
  const letterCode =
    rawCode.length > 0 &&
    rawCode.length <= MAX_LETTER_CODE_DIGITS &&
    /^\d+$/.test(rawCode)
      ? rawCode
      : null
  return {
    urlAttend: a === 'attend' || r === 'attend',
    letterCode,
    urlLetter: normalizeLetterBody(sp.get('letter') ?? sp.get('msg')),
    urlLetterAttend: normalizeLetterBody(sp.get('letterAttend') ?? sp.get('msgAttend')),
    urlLetterAbsent: normalizeLetterBody(sp.get('letterAbsent') ?? sp.get('msgAbsent')),
  }
}

function normalizeLetterBody(raw: string | null): string | null {
  if (raw == null) return null
  const t = raw.replace(/\r\n/g, '\n').trim()
  if (!t) return null
  if (t.length <= MAX_LETTER_BODY_LEN) return t
  return `${t.slice(0, MAX_LETTER_BODY_LEN - 1)}…`
}

function effectiveLetterBodies(hints: LetterUrlHints): {
  letter: string | null
  letterAttend: string | null
  letterAbsent: string | null
} {
  if (!hints.letterCode) {
    return {
      letter: hints.urlLetter,
      letterAttend: hints.urlLetterAttend,
      letterAbsent: hints.urlLetterAbsent,
    }
  }
  const pack = GUEST_LETTER_BY_CODE[hints.letterCode]
  if (!pack) {
    return {
      letter: hints.urlLetter,
      letterAttend: hints.urlLetterAttend,
      letterAbsent: hints.urlLetterAbsent,
    }
  }
  return {
    letter: normalizeLetterBody(pack.letter ?? null) ?? hints.urlLetter,
    letterAttend: normalizeLetterBody(pack.letterAttend ?? null) ?? hints.urlLetterAttend,
    letterAbsent: normalizeLetterBody(pack.letterAbsent ?? null) ?? hints.urlLetterAbsent,
  }
}

export function resolveLetterBody(
  submitOutcome: 'attend' | 'absent' | null,
  submitStatus: 'idle' | 'sending' | 'ok' | 'error',
  hints: LetterUrlHints
): string | null {
  if (submitStatus !== 'ok') return null
  const { letter, letterAttend, letterAbsent } = effectiveLetterBodies(hints)
  if (submitOutcome === 'attend') return letterAttend ?? letter ?? null
  if (submitOutcome === 'absent') return letterAbsent ?? letter ?? null
  return letter ?? null
}
