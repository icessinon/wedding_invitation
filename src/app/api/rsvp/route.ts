import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import {
  type DriveAuth,
  extractGoogleApiMessage,
  getDriveAuth,
  getOrCreateChildFolder,
  getSheetsAuth,
  withDriveQuotaHint,
} from '../../../lib/googleAuth'

export const runtime = 'nodejs'
export const maxDuration = 60

const HEADERS = [
  'guestSide',
  'relation',
  'relationship',
  'guestName',
  'guestNameKana',
  'gender',
  'postalCode',
  'address',
  'email',
  'allergy',
  'transport',
  'hasChildren',
  'childrenCount',
  'jointName',
  'jointPartnerNames',
  'message',
  'photo',
  'attendance',
] as const

type HeaderKey = (typeof HEADERS)[number]

/** スプレッドシート 1 行目に書く列名（フォームの name は従来どおり英語キー） */
const HEADER_LABELS_JA: Record<HeaderKey, string> = {
  guestSide: 'どちらのゲスト様',
  relation: 'ご関係（新郎新婦から見た）',
  relationship: '間柄（新郎新婦から見た）',
  guestName: 'お名前',
  guestNameKana: 'フリガナ',
  gender: '性別',
  postalCode: '郵便番号',
  address: 'ご住所',
  email: 'メールアドレス',
  allergy: 'アレルギーの有無・種類',
  transport: '交通手段',
  hasChildren: 'お子様の有無',
  childrenCount: 'お子様の人数',
  jointName: '夫婦参加時の連名の有無',
  jointPartnerNames: '連名の方のお名前',
  message: '新郎新婦へメッセージ',
  photo: 'メッセージ画像（URL・複数は改行）',
  attendance: 'ご出欠',
}

function formatCellForSheet(key: HeaderKey, value: string): string {
  switch (key) {
    case 'guestSide':
      if (value === 'groom') return '新郎ゲスト'
      if (value === 'bride') return '新婦ゲスト'
      return value
    case 'gender':
      if (value === 'male') return '男性'
      if (value === 'female') return '女性'
      if (value === 'other') return 'その他'
      return value
    case 'transport':
      if (value === 'train') return '電車'
      if (value === 'car') return 'お車'
      if (value === 'taxi') return 'タクシー'
      if (value === 'other') return 'その他'
      return value
    case 'hasChildren':
      if (value === 'yes') return 'あり'
      if (value === 'no') return 'なし'
      return value
    case 'childrenCount':
      if (!value.trim()) return '—'
      return `${value.trim()}名`
    case 'jointName':
      if (value === 'yes') return 'あり'
      if (value === 'no') return 'なし'
      return value
    case 'jointPartnerNames':
      if (!value.trim()) return '—'
      return value
    case 'attendance':
      if (value === 'attend') return 'ご出席'
      if (value === 'absent') return 'ご欠席'
      return value
    default:
      return value
  }
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_RSVP_IMAGES = 10

function parseChildrenCountFromForm(fd: FormData, hasChildren: string): string | null {
  if (hasChildren === 'no') return ''
  if (hasChildren !== 'yes') return null
  const raw = fd.get('childrenCount')
  if (typeof raw !== 'string' || !raw.trim()) return null
  const num = parseInt(raw, 10)
  if (!Number.isFinite(num) || num < 0 || num > 20) return null
  return String(num)
}

const MAX_JOINT_PARTNER_NAMES = 10
const MAX_JOINT_PARTNER_NAME_LEN = 80

function parseJointPartnerNamesFromBody(o: Record<string, unknown>, jointName: string): string | null {
  if (jointName !== 'yes' && jointName !== 'no') return null
  if (jointName === 'no') return ''
  const raw = o.jointPartnerNames
  let parts: string[] = []
  if (Array.isArray(raw)) {
    parts = raw.map((x) => String(x).trim()).filter(Boolean)
  } else if (typeof raw === 'string' && raw.trim()) {
    parts = raw
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (parts.length === 0 || parts.length > MAX_JOINT_PARTNER_NAMES) return null
  for (const p of parts) {
    if (p.length > MAX_JOINT_PARTNER_NAME_LEN) return null
  }
  return parts.join('\n')
}

function parseBody(body: unknown): Record<HeaderKey, string> | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const out: Partial<Record<HeaderKey, string>> = {}
  for (const key of HEADERS) {
    const v = o[key]
    if (key === 'photo') {
      out[key] = v == null ? '' : String(v)
      continue
    }
    if (key === 'childrenCount' || key === 'jointPartnerNames') continue
    if (typeof v !== 'string' || !v.trim()) return null
    out[key] = v.trim()
  }
  if (out.attendance !== 'attend' && out.attendance !== 'absent') return null
  const hc = out.hasChildren
  if (hc === 'no') {
    out.childrenCount = ''
  } else if (hc === 'yes') {
    const cc = o.childrenCount
    if (typeof cc !== 'string' || !cc.trim()) return null
    const num = parseInt(cc, 10)
    if (!Number.isFinite(num) || num < 0 || num > 20) return null
    out.childrenCount = String(num)
  } else {
    return null
  }
  const jn = out.jointName
  if (jn !== 'yes' && jn !== 'no') return null
  const jp = parseJointPartnerNamesFromBody(o, jn)
  if (jp === null) return null
  out.jointPartnerNames = jp
  return out as Record<HeaderKey, string>
}

function parseFormData(fd: FormData): { row: Record<HeaderKey, string>; imageFiles: File[] } | null {
  const out: Partial<Record<HeaderKey, string>> = {}
  for (const key of HEADERS) {
    if (key === 'photo' || key === 'childrenCount' || key === 'jointPartnerNames') continue
    const v = fd.get(key)
    if (typeof v !== 'string' || !v.trim()) return null
    out[key] = v.trim()
  }
  if (out.attendance !== 'attend' && out.attendance !== 'absent') return null

  const hc = out.hasChildren
  if (hc !== 'yes' && hc !== 'no') return null
  const cc = parseChildrenCountFromForm(fd, hc)
  if (cc === null) return null
  out.childrenCount = cc

  const jn = out.jointName
  if (jn !== 'yes' && jn !== 'no') return null
  const parts = fd
    .getAll('jointPartnerName')
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
  if (jn === 'yes') {
    if (parts.length === 0 || parts.length > MAX_JOINT_PARTNER_NAMES) return null
    for (const p of parts) {
      if (p.length > MAX_JOINT_PARTNER_NAME_LEN) return null
    }
    out.jointPartnerNames = parts.join('\n')
  } else {
    out.jointPartnerNames = ''
  }

  const rawPhotos = fd.getAll('photo')
  const imageFiles: File[] = []
  for (const p of rawPhotos) {
    if (p instanceof File && p.size > 0) {
      if (!p.type.startsWith('image/') || p.size > MAX_IMAGE_BYTES) return null
      imageFiles.push(p)
    }
  }
  if (imageFiles.length > MAX_RSVP_IMAGES) return null

  out.photo = ''
  return { row: out as Record<HeaderKey, string>, imageFiles }
}

function sanitizeGuestFolderName(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ') || 'ゲスト'
  const cleaned = t.replace(/[/\\?*:|"<>]/g, '_').slice(0, 120)
  return cleaned || 'ゲスト'
}

async function getOrCreateGuestFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  guestName: string
): Promise<string> {
  const folderName = sanitizeGuestFolderName(guestName)
  return getOrCreateChildFolder(drive, parentFolderId, folderName)
}

async function uploadRsvpImage(
  driveAuth: DriveAuth,
  rootFolderId: string,
  guestName: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('画像は image/* 形式のファイルを選んでください')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`画像は ${MAX_IMAGE_BYTES / 1024 / 1024}MB 以下にしてください`)
  }

  const drive = google.drive({ version: 'v3', auth: driveAuth })
  const guestFolderId = await getOrCreateGuestFolder(drive, rootFolderId, guestName)
  const buf = Buffer.from(await file.arrayBuffer())
  const base = file.name.replace(/[\r\n\0]/g, '').replace(/[/\\]/g, '_')
  const safe = base.replace(/[^\w.\-()\s\u3000-\u30ff\u3040-\u309f\u4e00-\u9faf]/g, '_').slice(0, 100)
  const name = `rsvp_${Date.now()}_${safe || 'image'}`

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [guestFolderId],
    },
    media: {
      mimeType: file.type || 'application/octet-stream',
      body: Readable.from(buf),
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  const fileId = created.data.id
  if (!fileId) throw new Error('Google Drive へのアップロードに失敗しました')

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  const meta = await drive.files.get({
    fileId,
    fields: 'webViewLink',
    supportsAllDrives: true,
  })

  return meta.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`
}

async function firstSheetTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<string> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  const title = res.data.sheets?.[0]?.properties?.title
  if (!title) throw new Error('スプレッドシートにシートがありません')
  return title
}

export async function POST(request: Request) {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    return NextResponse.json(
      { ok: false, error: 'GOOGLE_SPREADSHEET_ID が未設定です' },
      { status: 500 }
    )
  }

  const driveFolderId = process.env.GOOGLE_DRIVE_RSVP_FOLDER_ID?.trim()
  const contentType = request.headers.get('content-type') ?? ''

  let data: Record<HeaderKey, string>

  if (contentType.includes('multipart/form-data')) {
    let fd: FormData
    try {
      fd = await request.formData()
    } catch {
      return NextResponse.json({ ok: false, error: 'フォームデータの解析に失敗しました' }, { status: 400 })
    }
    const parsed = parseFormData(fd)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: '入力内容が不正です' }, { status: 400 })
    }
    const { row, imageFiles } = parsed
    data = { ...row }
    if (imageFiles.length > 0) {
      if (!driveFolderId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              '画像を送信するには .env の GOOGLE_DRIVE_RSVP_FOLDER_ID に、アップロード先フォルダのIDを設定してください',
          },
          { status: 400 }
        )
      }
      try {
        const driveAuth = getDriveAuth()
        const urls = await Promise.all(
          imageFiles.map((file) => uploadRsvpImage(driveAuth, driveFolderId, data.guestName, file))
        )
        data.photo = urls.join('\n')
      } catch (e) {
        const raw = extractGoogleApiMessage(e)
        const message = withDriveQuotaHint(raw)
        console.error('[api/rsvp] drive upload', e)
        return NextResponse.json({ ok: false, error: message }, { status: 400 })
      }
    }
  } else {
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'JSON の解析に失敗しました' }, { status: 400 })
    }
    const parsed = parseBody(json)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: '入力内容が不正です' }, { status: 400 })
    }
    data = parsed
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getSheetsAuth() })
    const sheetTitle = await firstSheetTitle(sheets, spreadsheetId)
    const escape = (name: string) => `'${name.replace(/'/g, "''")}'`
    const quoted = escape(sheetTitle)

    const headerRange = `${quoted}!1:1`
    const firstRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
    })
    const row0 = firstRow.data.values?.[0]
    const needsHeader =
      !row0?.length ||
      !row0.some((cell: unknown) => String(cell ?? '').trim() !== '')

    if (needsHeader) {
      const headerRow = HEADERS.map((k) => HEADER_LABELS_JA[k])
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${quoted}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headerRow] },
      })
    }

    const row = HEADERS.map((key) => formatCellForSheet(key, data[key]))
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoted}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'スプレッドシートへの書き込みに失敗しました'
    console.error('[api/rsvp]', e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
