import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { getSheetsAuth } from '../../../lib/googleAuth'
import {
  LIST_SEPARATOR,
  MAX_ACTIVITIES,
  MAX_ACTIVITY_LEN,
  MAX_DESTINATIONS,
  MAX_DESTINATION_LEN,
  MAX_NAME_LEN,
  MONTH_KEYS,
  formatActivity,
  parseActivity,
  type SurveyActivity,
  type SurveyEntry,
} from '../../../lib/travelSurvey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** 回答を保存するシート（タブ）名。RSVP と同じスプレッドシート内に自動作成する */
const SHEET_TITLE = '旅行アンケート'
const HEADER_ROW = ['送信日時', 'お名前', '行きたい旅行先', '行ける月', 'やりたいこと']

type ParsedSubmission = Pick<SurveyEntry, 'name' | 'destinations' | 'months' | 'activities'>

function parseActivities(raw: unknown): SurveyActivity[] | null {
  if (raw == null) return []
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const activities: SurveyActivity[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const { name, month } = item as Record<string, unknown>
    if (typeof name !== 'string') return null
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed || trimmed.length > MAX_ACTIVITY_LEN || trimmed.includes(LIST_SEPARATOR)) return null
    const monthKey = month == null ? null : MONTH_KEYS.find((m) => m === month)
    if (monthKey === undefined) return null
    const key = `${trimmed}|${monthKey ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    activities.push({ name: trimmed, month: monthKey })
  }
  // MAX_ACTIVITIES は「種類数」の上限。月違いの同名は 1 種類と数える
  const kinds = new Set(activities.map((a) => a.name)).size
  if (kinds > MAX_ACTIVITIES) return null
  if (activities.length > MAX_ACTIVITIES * MONTH_KEYS.length) return null
  return activities
}

function parseSubmission(body: unknown): ParsedSubmission | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>

  if (typeof o.name !== 'string') return null
  const name = o.name.trim().replace(/\s+/g, ' ')
  if (!name || name.length > MAX_NAME_LEN) return null

  if (!Array.isArray(o.destinations)) return null
  const destinations = [
    ...new Set(
      o.destinations
        .map((d) => String(d).trim().replace(/\s+/g, ' '))
        .filter(Boolean)
    ),
  ]
  if (destinations.length === 0 || destinations.length > MAX_DESTINATIONS) return null
  if (destinations.some((d) => d.length > MAX_DESTINATION_LEN || d.includes(LIST_SEPARATOR))) return null

  if (!Array.isArray(o.months)) return null
  const monthSet = new Set(o.months.map((m) => String(m)))
  const months = MONTH_KEYS.filter((m) => monthSet.has(m))
  if (months.length === 0) return null

  const activities = parseActivities(o.activities)
  if (activities === null) return null

  return { name, destinations, months, activities }
}

function getSpreadsheetId(): string | null {
  return (
    process.env.GOOGLE_SURVEY_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SPREADSHEET_ID?.trim() ||
    null
  )
}

function quotedRange(range: string): string {
  return `'${SHEET_TITLE.replace(/'/g, "''")}'!${range}`
}

async function sheetExists(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<boolean> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  return (res.data.sheets ?? []).some((s) => s.properties?.title === SHEET_TITLE)
}

async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<void> {
  if (!(await sheetExists(sheets, spreadsheetId))) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TITLE } } }],
      },
    })
  }

  // 列を増やしたときも 1 行目を最新のヘッダーに揃える（このシートはアプリ専用管理）
  const firstRow = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: quotedRange('1:1'),
  })
  const row0 = (firstRow.data.values?.[0] ?? []).map((cell: unknown) => String(cell ?? '').trim())
  const headerUpToDate =
    row0.length >= HEADER_ROW.length && HEADER_ROW.every((label, i) => row0[i] === label)
  if (!headerUpToDate) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: quotedRange('A1'),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADER_ROW] },
    })
  }
}

function rowToEntry(row: unknown[]): SurveyEntry | null {
  const at = String(row[0] ?? '').trim()
  const name = String(row[1] ?? '').trim()
  const destinations = String(row[2] ?? '')
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean)
  const monthSet = new Set(
    String(row[3] ?? '')
      .split(LIST_SEPARATOR)
      .map((s) => s.trim())
  )
  const months = MONTH_KEYS.filter((m) => monthSet.has(m))
  const activities = String(row[4] ?? '')
    .split(LIST_SEPARATOR)
    .map((s) => parseActivity(s))
    .filter((a): a is SurveyActivity => a !== null)
  if (!name || destinations.length === 0 || months.length === 0) return null
  return { at, name, destinations, months, activities }
}

export async function GET() {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: 'GOOGLE_SPREADSHEET_ID が未設定です' }, { status: 500 })
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getSheetsAuth() })
    if (!(await sheetExists(sheets, spreadsheetId))) {
      return NextResponse.json({ ok: true, entries: [] })
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: quotedRange('A2:E'),
    })

    // 同じ名前の再送信は「最新の回答」を有効にする（行は追記のみなので後勝ち）
    const latestByName = new Map<string, SurveyEntry>()
    for (const row of res.data.values ?? []) {
      const entry = rowToEntry(row)
      if (entry) latestByName.set(entry.name, entry)
    }

    return NextResponse.json({ ok: true, entries: [...latestByName.values()] })
  } catch (e) {
    const message = e instanceof Error ? e.message : '回答の取得に失敗しました'
    console.error('[api/survey] GET', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const spreadsheetId = getSpreadsheetId()
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: 'GOOGLE_SPREADSHEET_ID が未設定です' }, { status: 500 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON の解析に失敗しました' }, { status: 400 })
  }

  const parsed = parseSubmission(json)
  if (!parsed) {
    return NextResponse.json({ ok: false, error: '入力内容が不正です' }, { status: 400 })
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getSheetsAuth() })
    await ensureSheet(sheets, spreadsheetId)

    const at = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: quotedRange('A1'),
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            at,
            parsed.name,
            parsed.destinations.join(LIST_SEPARATOR),
            parsed.months.join(LIST_SEPARATOR),
            parsed.activities.map(formatActivity).join(LIST_SEPARATOR),
          ],
        ],
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '回答の保存に失敗しました'
    console.error('[api/survey] POST', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
