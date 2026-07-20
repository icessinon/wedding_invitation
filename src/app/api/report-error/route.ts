import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { getSheetsAuth } from '../../../lib/googleAuth'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * ゲスト側で起きたエラーを RSVP スプレッドシートの「エラー報告」タブに記録する。
 * シートの通知設定（ツール → 通知設定）を有効にすれば新郎新婦へメールが届く。
 */

const SHEET_TITLE = 'エラー報告'
const HEADER = ['日時', '場面', '内容', '端末', 'ページ']
const MAX_LEN = 500

let sheetReady = false

async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<void> {
  if (sheetReady) return
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_TITLE)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TITLE } } }] },
    })
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_TITLE}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADER] },
    })
  }
  sheetReady = true
}

function clean(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_LEN) : ''
}

export async function POST(request: Request) {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    // 記録先がなくてもゲスト側の動作は妨げない
    return NextResponse.json({ ok: true })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const context = clean(body.context)
  const message = clean(body.message)
  if (!context && !message) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getSheetsAuth() })
    await ensureSheet(sheets, spreadsheetId)

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_TITLE}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[now, context, message, clean(body.userAgent), clean(body.page)]],
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/report-error]', e)
    // 報告の失敗はゲストに影響させない
    return NextResponse.json({ ok: true })
  }
}
