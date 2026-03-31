import { createPrivateKey } from 'node:crypto'
import { existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const SCOPE_SHEETS = 'https://www.googleapis.com/auth/spreadsheets'
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive'

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
      if (value === 'na') return '該当なし'
      return value
    case 'attendance':
      if (value === 'attend') return 'ご出席'
      if (value === 'absent') return 'ご欠席'
      return value
    default:
      return value
  }
}

type RsvpGoogleAuth = InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.GoogleAuth>
type DriveAuth = RsvpGoogleAuth | InstanceType<typeof google.auth.OAuth2>

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_RSVP_IMAGES = 10

const QUOTA_HINT =
  'サービスアカウントはマイドライブの容量を持ちません。共有ドライブ上のフォルダを GOOGLE_DRIVE_RSVP_FOLDER_ID に指定するか、.env で GOOGLE_DRIVE_OAUTH_*（ユーザーのDriveに保存）を設定してください。https://developers.google.com/drive/api/guides/about-shareddrives'

function normalizeServiceAccountPrivateKey(raw: string): string {
  let k = raw.trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  while (k.includes('\\n')) {
    k = k.replace(/\\n/g, '\n')
  }
  k = k.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (k.charCodeAt(0) === 0xfeff) {
    k = k.slice(1)
  }
  return k.trim()
}

function assertDecodablePemPrivateKey(key: string, envName: string): void {
  try {
    createPrivateKey({ key, format: 'pem' })
  } catch {
    throw new Error(
      `${envName} を PEM として解釈できません（error:1E08010C など）。JSON の private_key をそのままコピーし、改行は \\n の1行形式にするか、ホストの UI では値の外側に引用符を付けないでください。`
    )
  }
}

function buildServiceAccountAuth(scopes: readonly string[]): RsvpGoogleAuth {
  const keyFile =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()

  if (keyFile) {
    if (!existsSync(keyFile)) {
      throw new Error(`認証用JSONファイルが見つかりません: ${keyFile}`)
    }
    return new google.auth.GoogleAuth({
      keyFile,
      scopes: [...scopes],
    })
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY_FILE（または GOOGLE_APPLICATION_CREDENTIALS）、もしくは GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY を設定してください'
    )
  }
  const key = normalizeServiceAccountPrivateKey(rawKey)
  assertDecodablePemPrivateKey(key, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  return new google.auth.JWT({
    email,
    key,
    scopes: [...scopes],
  })
}

/** スプレッドシート用（サービスアカウントのみ） */
function getSheetsAuth(): RsvpGoogleAuth {
  return buildServiceAccountAuth([SCOPE_SHEETS])
}

/**
 * Drive 用: OAuth リフレッシュトークンがあればユーザーの容量で保存。
 * なければサービスアカウント（共有ドライブ上のフォルダが必須）
 */
function getDriveAuth(): DriveAuth {
  const rt = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim()
  const cid = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim()
  const cs = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim()
  if (rt && cid && cs) {
    const oauth2 = new google.auth.OAuth2(cid, cs)
    oauth2.setCredentials({ refresh_token: rt })
    return oauth2
  }
  return buildServiceAccountAuth([SCOPE_DRIVE])
}

function extractGoogleApiMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { error?: { message?: string } } } }).response
    const m = r?.data?.error?.message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  if (e instanceof Error) return e.message
  return 'リクエストに失敗しました'
}

function withDriveQuotaHint(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('storage quota') ||
    lower.includes('service accounts do not have storage') ||
    lower.includes('does not have storage quota')
  ) {
    return `${message} — ${QUOTA_HINT}`
  }
  return message
}

function parseChildrenCountFromForm(fd: FormData, hasChildren: string): string | null {
  if (hasChildren === 'no') return ''
  if (hasChildren !== 'yes') return null
  const raw = fd.get('childrenCount')
  if (typeof raw !== 'string' || !raw.trim()) return null
  const num = parseInt(raw, 10)
  if (!Number.isFinite(num) || num < 0 || num > 20) return null
  return String(num)
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
    if (key === 'childrenCount') continue
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
  return out as Record<HeaderKey, string>
}

function parseFormData(fd: FormData): { row: Record<HeaderKey, string>; imageFiles: File[] } | null {
  const out: Partial<Record<HeaderKey, string>> = {}
  for (const key of HEADERS) {
    if (key === 'photo' || key === 'childrenCount') continue
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

/** Drive の q= 用に単一引用符をエスケープ */
function escapeDriveQueryLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function getOrCreateGuestFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  guestName: string
): Promise<string> {
  const folderName = sanitizeGuestFolderName(guestName)
  const escaped = escapeDriveQueryLiteral(folderName)
  const list = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${escaped}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 2,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existingId = list.data.files?.[0]?.id
  if (existingId) return existingId

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  const id = created.data.id
  if (!id) throw new Error('お名前フォルダの作成に失敗しました')
  return id
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
        const urls: string[] = []
        for (const file of imageFiles) {
          urls.push(await uploadRsvpImage(driveAuth, driveFolderId, data.guestName, file))
        }
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
