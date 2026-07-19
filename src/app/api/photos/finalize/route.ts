import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { extractGoogleApiMessage, getDriveAuth } from '../../../../lib/googleAuth'
import { resolvePhotosFolderId, toSharedPhoto } from '../../../../lib/photosDrive'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * 直接アップロード（/api/photos/upload-session → Drive へ PUT）の仕上げ。
 * 共有フォルダ内のファイルであることを確認してから閲覧権限を付ける。
 */
export async function POST(request: Request) {
  let body: { fileId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON の解析に失敗しました' }, { status: 400 })
  }
  const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : ''
  if (!fileId || !/^[\w-]{10,}$/.test(fileId)) {
    return NextResponse.json({ ok: false, error: 'fileId が不正です' }, { status: 400 })
  }

  try {
    const drive = google.drive({ version: 'v3', auth: getDriveAuth() })
    const folderId = await resolvePhotosFolderId(drive)

    const meta = await drive.files.get({
      fileId,
      fields:
        'id, name, mimeType, parents, createdTime, thumbnailLink, appProperties, imageMediaMetadata(width, height), videoMediaMetadata(width, height, durationMillis)',
      supportsAllDrives: true,
    })

    if (!meta.data.parents?.includes(folderId)) {
      return NextResponse.json({ ok: false, error: '共有フォルダ外のファイルです' }, { status: 403 })
    }
    const mime = meta.data.mimeType ?? ''
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      return NextResponse.json({ ok: false, error: '画像または動画のみ共有できます' }, { status: 400 })
    }

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    })

    const item = toSharedPhoto(meta.data)
    if (!item) throw new Error('ファイル情報の取得に失敗しました')
    return NextResponse.json({ ok: true, photos: [item] })
  } catch (e) {
    console.error('[api/photos/finalize]', e)
    return NextResponse.json(
      { ok: false, error: extractGoogleApiMessage(e) },
      { status: 500 }
    )
  }
}
