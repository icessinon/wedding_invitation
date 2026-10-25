import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { getSheetsAuth } from '../../../lib/googleAuth'
import {
  LIST_SEPARATOR,
  MAX_DATES,
  MAX_NAME_LEN,
  isScheduleDate,
  type DateKey,
  type ScheduleEntry,
} from '../../../lib/travelSchedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** 回答を保存するシート（タブ）名。旅行アンケートと同じスプレッドシート内に自動作成する */
const SHEET_TITLE = '日程調整'
const HEADER_ROW = ['送信日時', 'お名前', '行ける日', '日数']

type ParsedSubmission = Pick<ScheduleEntry, 'name' | 'dates'>

function parseSubmission(body: unknown): ParsedSubmission | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>

  if (typeof o.name !== 'string') return null
  const name = o.name.trim().replace(/\s+/g, ' ')
  if (!name || name.length > MAX_NAME_LEN) return null

  if (!Array.isArray(o.dates)) return null
  const dates = [...new Set(o.dates.map((d) => String(d).trim()))].filter(Boolean)
  if (dates.length > MAX_DATES) return null
  if (dates.some((d) => !isScheduleDate(d))) return null
  dates.sort()

  return { name, dates }
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

function rowToEntry(row: unknown[]): ScheduleEntry | null {
  const at = String(row[0] ?? '').trim()
  const name = String(row[1] ?? '').trim()
  const dates = String(row[2] ?? '')
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter((s): s is DateKey => isScheduleDate(s))
  if (!name) return null
  dates.sort()
  return { at, name, dates }
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
      range: quotedRange('A2:D'),
    })

    // 同じ名前の再送信は「最新の回答」を有効にする（行は追記のみなので後勝ち）
    const latestByName = new Map<string, ScheduleEntry>()
    for (const row of res.data.values ?? []) {
      const entry = rowToEntry(row)
      if (entry) latestByName.set(entry.name, entry)
    }

    return NextResponse.json({ ok: true, entries: [...latestByName.values()] })
  } catch (e) {
    const message = e instanceof Error ? e.message : '回答の取得に失敗しました'
    console.error('[api/schedule] GET', e)
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
        values: [[at, parsed.name, parsed.dates.join(LIST_SEPARATOR), parsed.dates.length]],
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '回答の保存に失敗しました'
    console.error('[api/schedule] POST', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
