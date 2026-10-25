/** 日程調整（行ける日カレンダー）でサーバー・クライアント共通で使う定数と型 */

import { LIST_SEPARATOR, MAX_NAME_LEN } from './travelSurvey'

export { LIST_SEPARATOR, MAX_NAME_LEN }

/** 候補にする月。旅行アンケートの「11月以降」にあわせて 2026年11月〜2027年4月 */
export const SCHEDULE_MONTHS = [
  { year: 2026, month: 11 },
  { year: 2026, month: 12 },
  { year: 2027, month: 1 },
  { year: 2027, month: 2 },
  { year: 2027, month: 3 },
  { year: 2027, month: 4 },
] as const

export type ScheduleMonth = (typeof SCHEDULE_MONTHS)[number]

/**
 * 月ごとのイベント候補。旅行アンケート（行き先・やりたいこと）から作った叩き台で、
 * ここは決め打ちの「今月はこれ」。回答するのは「行ける日」だけ。
 */
export type MonthPlan = {
  year: number
  month: number
  title: string
  destinations: string[]
  activities: string[]
  note: string
}

export const MONTH_PLANS: MonthPlan[] = [
  {
    year: 2026,
    month: 11,
    title: '紅葉と温泉',
    destinations: ['箱根・熱海'],
    activities: ['温泉', '観光・街歩き', 'コテージ'],
    note: '紅葉シーズン。1泊2日で温泉と街歩きの定番コース',
  },
  {
    year: 2026,
    month: 12,
    title: '年末の温泉＆グルメ',
    destinations: ['箱根・熱海', '長野'],
    activities: ['温泉', 'グルメ', 'コテージ'],
    note: '年末年始の前に。コテージ泊でのんびり集まる案',
  },
  {
    year: 2027,
    month: 1,
    title: '雪見温泉',
    destinations: ['長野', '北海道'],
    activities: ['温泉', 'スキー・スノボ'],
    note: '雪のシーズン本番。滑る人・入る人どちらもOKの宿で',
  },
  {
    year: 2027,
    month: 2,
    title: 'スキー＆スノボ合宿',
    destinations: ['長野', '北海道'],
    activities: ['スキー・スノボ', '温泉', 'コテージ'],
    note: 'アンケートでは全員が行けると回答。雪＋温泉のいいとこ取り',
  },
  {
    year: 2027,
    month: 3,
    title: '温泉でのんびり',
    destinations: ['箱根・熱海'],
    activities: ['温泉', '観光・街歩き', 'のんびり'],
    note: 'こちらも全員OK。人気No.1の箱根・熱海でゆっくり',
  },
  {
    year: 2027,
    month: 4,
    title: '春のテーマパーク',
    destinations: ['京都・大阪', '九州'],
    activities: ['テーマパーク', '観光・街歩き', 'グルメ'],
    note: '暖かくなる時期。遠出や2泊3日も組みやすい',
  },
]

/** 1人あたりに選べる日数の上限（候補期間の全日数より少し多め） */
export const MAX_DATES = 200

/** 'YYYY-MM-DD' の文字列。タイムゾーンに左右されないようこの形式だけを扱う */
export type DateKey = string

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function toDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** その月の全日付（'YYYY-MM-DD'）を 1 日から順に返す */
export function monthDates(year: number, month: number): DateKey[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => toDateKey(year, month, i + 1))
}

/** 曜日番号（0=日）。UTC で固定して端末のタイムゾーンの影響を受けないようにする */
export function weekdayOf(key: DateKey): number {
  const d = parseDateKey(key)
  if (!d) return 0
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()
}

/** 候補期間の日かどうか（保存前の検証にも使う） */
export function isScheduleDate(key: unknown): key is DateKey {
  if (typeof key !== 'string') return false
  const d = parseDateKey(key)
  if (!d) return false
  if (!SCHEDULE_MONTHS.some((m) => m.year === d.year && m.month === d.month)) return false
  return d.day >= 1 && d.day <= daysInMonth(d.year, d.month)
}

/** 候補期間の全日付 */
export function allScheduleDates(): DateKey[] {
  return SCHEDULE_MONTHS.flatMap((m) => monthDates(m.year, m.month))
}

/** 翌日の日付。候補期間の外になる場合は null */
export function nextDate(key: DateKey): DateKey | null {
  const d = parseDateKey(key)
  if (!d) return null
  const next = new Date(Date.UTC(d.year, d.month - 1, d.day + 1))
  const nextKey = toDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
  return isScheduleDate(nextKey) ? nextKey : null
}

/** 「2月14日(土)」形式 */
export function formatDateLabel(key: DateKey): string {
  const d = parseDateKey(key)
  if (!d) return key
  return `${d.month}月${d.day}日(${WEEKDAY_LABELS[weekdayOf(key)]})`
}

/** 「2/14(土)」形式（候補リストなど狭いところ用） */
export function formatDateShort(key: DateKey): string {
  const d = parseDateKey(key)
  if (!d) return key
  return `${d.month}/${d.day}(${WEEKDAY_LABELS[weekdayOf(key)]})`
}

export type ScheduleEntry = {
  at: string
  name: string
  dates: DateKey[]
}
