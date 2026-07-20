import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { extractGoogleApiMessage, getDriveAuth } from '../../../../lib/googleAuth'
import { resolvePhotosFolderId } from '../../../../lib/photosDrive'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * 動画など大きいファイル用に、Google Drive の「再開可能アップロード」の
 * セッション URL を発行する。ブラウザはこの URL に直接 PUT するので、
 * ホスティングのリクエストサイズ上限（Vercel 約4.5MB）を通らない。
 */

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024 // 2GB（iPhoneの4K長尺も収まる）
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_UPLOADER_NAME_LEN = 60

function sanitizeFileName(raw: string): string {
  const base = raw.replace(/[\r\n\0]/g, '').replace(/[/\\]/g, '_')
  const safe = base.replace(/[^\w.\-()\s　-ヿ぀-ゟ一-龯]/g, '_').slice(0, 100)
  return safe || 'file'
}

export async function POST(request: Request) {
  let body: { fileName?: unknown; mimeType?: unknown; size?: unknown; uploaderName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON の解析に失敗しました' }, { status: 400 })
  }

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const size = typeof body.size === 'number' && Number.isFinite(body.size) ? body.size : -1
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'file'
  const uploader =
    typeof body.uploaderName === 'string'
      ? body.uploaderName.replace(/[\r\n\0]/g, ' ').trim().slice(0, MAX_UPLOADER_NAME_LEN)
      : ''

  const isVideo = mimeType.startsWith('video/')
  const isImage = mimeType.startsWith('image/')
  if (!isVideo && !isImage) {
    return NextResponse.json({ ok: false, error: '画像または動画のみ送信できます' }, { status: 400 })
  }
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (size <= 0 || size > maxBytes) {
    return NextResponse.json(
      { ok: false, error: `ファイルサイズは ${Math.round(maxBytes / 1024 / 1024)}MB 以下にしてください` },
      { status: 400 }
    )
  }

  try {
    const auth = getDriveAuth()
    const drive = google.drive({ version: 'v3', auth })
    const folderId = await resolvePhotosFolderId(drive)

    const tokenResult = await auth.getAccessToken()
    const token = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token
    if (!token) throw new Error('アクセストークンの取得に失敗しました')

    // ブラウザが直接 PUT できるよう、セッションにサイトの Origin を紐付ける（CORS 許可）
    const origin =
      request.headers.get('origin') ??
      (request.headers.get('host') ? `https://${request.headers.get('host')}` : '')

    const name = `memory_${Date.now()}_${sanitizeFileName(fileName)}`
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(size),
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({
          name,
          parents: [folderId],
          appProperties: uploader ? { uploader } : undefined,
        }),
      }
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`アップロードセッションの作成に失敗しました: ${text.slice(0, 200)}`)
    }
    const uploadUrl = res.headers.get('location')
    if (!uploadUrl) throw new Error('アップロードURLを取得できませんでした')

    return NextResponse.json({ ok: true, uploadUrl })
  } catch (e) {
    console.error('[api/photos/upload-session]', e)
    return NextResponse.json(
      { ok: false, error: extractGoogleApiMessage(e) },
      { status: 500 }
    )
  }
}
