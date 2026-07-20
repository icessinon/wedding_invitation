import { createPrivateKey } from 'node:crypto'
import { existsSync } from 'node:fs'
import { google } from 'googleapis'

export const SCOPE_SHEETS = 'https://www.googleapis.com/auth/spreadsheets'
export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive'

export type RsvpGoogleAuth = InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.GoogleAuth>
export type DriveAuth = RsvpGoogleAuth | InstanceType<typeof google.auth.OAuth2>

export const QUOTA_HINT =
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

export function buildServiceAccountAuth(scopes: readonly string[]): RsvpGoogleAuth {
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

let cachedSheetsAuth: RsvpGoogleAuth | null = null
let cachedDriveAuth: DriveAuth | null = null

/** スプレッドシート用（サービスアカウントのみ） */
export function getSheetsAuth(): RsvpGoogleAuth {
  if (!cachedSheetsAuth) {
    cachedSheetsAuth = buildServiceAccountAuth([SCOPE_SHEETS])
  }
  return cachedSheetsAuth
}

/**
 * Drive 用: OAuth リフレッシュトークンがあればユーザーの容量で保存。
 * なければサービスアカウント（共有ドライブ上のフォルダが必須）。
 * クライアントをプロセス内で再利用し、アクセストークンの再取得を避ける。
 */
export function getDriveAuth(): DriveAuth {
  if (cachedDriveAuth) return cachedDriveAuth
  const rt = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim()
  const cid = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim()
  const cs = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim()
  if (rt && cid && cs) {
    const oauth2 = new google.auth.OAuth2(cid, cs)
    oauth2.setCredentials({ refresh_token: rt })
    cachedDriveAuth = oauth2
  } else {
    cachedDriveAuth = buildServiceAccountAuth([SCOPE_DRIVE])
  }
  return cachedDriveAuth
}

export function extractGoogleApiMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { error?: { message?: string } } } }).response
    const m = r?.data?.error?.message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  if (e instanceof Error) return e.message
  return 'リクエストに失敗しました'
}

export function withDriveQuotaHint(message: string): string {
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

/** Drive の q= 用に単一引用符をエスケープ */
export function escapeDriveQueryLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** 親フォルダ直下に指定名のフォルダを探し、なければ作成して ID を返す */
export async function getOrCreateChildFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  folderName: string
): Promise<string> {
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
  if (!id) throw new Error(`フォルダ「${folderName}」の作成に失敗しました`)
  return id
}
