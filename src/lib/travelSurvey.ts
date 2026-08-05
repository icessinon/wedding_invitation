/** 旅行アンケートでサーバー・クライアント共通で使う定数と型 */

/** 選択できる月（2026年9月〜2027年4月）。表示・保存・集計すべてこの順序 */
export const MONTH_KEYS = ['9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月'] as const

export type MonthKey = (typeof MONTH_KEYS)[number]

/** 月ごとの年表記（チップの補助ラベル用） */
export const MONTH_YEARS: Record<MonthKey, string> = {
  '9月': '2026',
  '10月': '2026',
  '11月': '2026',
  '12月': '2026',
  '1月': '2027',
  '2月': '2027',
  '3月': '2027',
  '4月': '2027',
}

export const MAX_NAME_LEN = 40
export const MAX_DESTINATIONS = 8
export const MAX_DESTINATION_LEN = 30
/** やりたいことの「種類数」の上限（月違いの同名は 1 種類と数える） */
export const MAX_ACTIVITIES = 8
export const MAX_ACTIVITY_LEN = 30

/** スプレッドシートのセル内で複数値を区切る文字 */
export const LIST_SEPARATOR = '、'

/** やりたいこと。month を付けると「この月にこれがやりたい」の意味になる */
export type SurveyActivity = {
  name: string
  month: MonthKey | null
}

export type SurveyEntry = {
  at: string
  name: string
  destinations: string[]
  months: string[]
  activities: SurveyActivity[]
}

/** セル保存用の「スキー（12月）」形式 */
export function formatActivity(a: SurveyActivity): string {
  return a.month ? `${a.name}（${a.month}）` : a.name
}

const ACTIVITY_MONTH_RE = new RegExp(`^(.+?)（(${MONTH_KEYS.join('|')})）$`)

export function parseActivity(raw: string): SurveyActivity | null {
  const s = raw.trim()
  if (!s) return null
  const m = s.match(ACTIVITY_MONTH_RE)
  if (m) return { name: m[1].trim(), month: m[2] as MonthKey }
  return { name: s, month: null }
}
