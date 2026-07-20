import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import {
  extractGoogleApiMessage,
  getDriveAuth,
  withDriveQuotaHint,
} from '../../../lib/googleAuth'
import {
  listPhotos,
  resolvePhotosFolderId,
  toSharedPhoto,
  type DriveClient,
  type SharedPhoto,
} from '../../../lib/photosDrive'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 10
const MAX_UPLOADER_NAME_LEN = 60

export async function GET() {
  try {
    const drive = google.drive({ version: 'v3', auth: getDriveAuth() })
    const folderId = await resolvePhotosFolderId(drive)
    const photos = await listPhotos(drive, folderId)
    return NextResponse.json(
      { ok: true, photos },
      {
        headers: {
          // CDN に1分キャッシュ（新規投稿は投稿者自身の画面には即時反映される）
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (e) {
    console.error('[api/photos] list', e)
    return NextResponse.json(
      { ok: false, error: withDriveQuotaHint(extractGoogleApiMessage(e)) },
      { status: 500 }
    )
  }
}

function sanitizeUploaderName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\r\n\0]/g, ' ').trim().slice(0, MAX_UPLOADER_NAME_LEN)
}

function sanitizeFileName(raw: string): string {
  const base = raw.replace(/[\r\n\0]/g, '').replace(/[/\\]/g, '_')
  const safe = base.replace(/[^\w.\-()\s　-ヿ぀-ゟ一-龯]/g, '_').slice(0, 100)
  return safe || 'image'
}

async function uploadPhoto(
  drive: DriveClient,
  folderId: string,
  uploader: string,
  file: File
): Promise<SharedPhoto> {
  const buf = Buffer.from(await file.arrayBuffer())
  const name = `memory_${Date.now()}_${sanitizeFileName(file.name)}`

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      appProperties: uploader ? { uploader } : undefined,
    },
    media: {
      mimeType: file.type || 'application/octet-stream',
      body: Readable.from(buf),
    },
    fields: 'id, name, createdTime, appProperties, imageMediaMetadata(width, height)',
    supportsAllDrives: true,
  })

  const fileId = created.data.id
  if (!fileId) throw new Error('Google Drive へのアップロードに失敗しました')

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })

  const photo = toSharedPhoto(created.data)
  if (!photo) throw new Error('アップロード結果の取得に失敗しました')
  return photo
}

export async function POST(request: Request) {
  let fd: FormData
  try {
    fd = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'フォームデータの解析に失敗しました' }, { status: 400 })
  }

  const uploader = sanitizeUploaderName(fd.get('uploaderName'))
  const files: File[] = []
  for (const p of fd.getAll('photo')) {
    if (p instanceof File && p.size > 0) {
      if (!p.type.startsWith('image/')) {
        return NextResponse.json(
          { ok: false, error: '画像は image/* 形式のファイルを選んでください' },
          { status: 400 }
        )
      }
      if (p.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { ok: false, error: `画像は ${MAX_IMAGE_BYTES / 1024 / 1024}MB 以下にしてください` },
          { status: 400 }
        )
      }
      files.push(p)
    }
  }
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: '写真が選択されていません' }, { status: 400 })
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { ok: false, error: `一度に送れる写真は ${MAX_FILES_PER_REQUEST} 枚までです` },
      { status: 400 }
    )
  }

  try {
    const drive = google.drive({ version: 'v3', auth: getDriveAuth() })
    const folderId = await resolvePhotosFolderId(drive)
    const photos: SharedPhoto[] = []
    for (const file of files) {
      photos.push(await uploadPhoto(drive, folderId, uploader, file))
    }
    return NextResponse.json({ ok: true, photos })
  } catch (e) {
    console.error('[api/photos] upload', e)
    return NextResponse.json(
      { ok: false, error: withDriveQuotaHint(extractGoogleApiMessage(e)) },
      { status: 500 }
    )
  }
}
