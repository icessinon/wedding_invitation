import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { extractGoogleApiMessage, getDriveAuth } from '../../../../../lib/googleAuth'
import { resolvePhotosFolderId } from '../../../../../lib/photosDrive'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * 動画をネイティブ <video> で再生できるよう、Drive からストリーミング中継する。
 * Range リクエスト（シーク）も Drive にそのまま転送する。
 */

/** 共有フォルダ内と確認済みの fileId → ファイルサイズ（プロセス内キャッシュ） */
const verifiedIds = new Map<string, number>()

/**
 * このサイズ未満の公開ファイルは Google から直接配信できる
 * （これ以上はウイルススキャンの確認ページが挟まるため中継する）
 */
const DIRECT_STREAM_MAX_BYTES = 95 * 1024 * 1024

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params
  if (!fileId || !/^[\w-]{10,}$/.test(fileId)) {
    return NextResponse.json({ ok: false, error: 'fileId が不正です' }, { status: 400 })
  }

  try {
    const auth = getDriveAuth()
    const drive = google.drive({ version: 'v3', auth })

    let fileSize = verifiedIds.get(fileId)
    if (fileSize === undefined) {
      const folderId = await resolvePhotosFolderId(drive)
      const meta = await drive.files.get({
        fileId,
        fields: 'id, mimeType, parents, size',
        supportsAllDrives: true,
      })
      const mime = meta.data.mimeType ?? ''
      if (!meta.data.parents?.includes(folderId) || !(mime.startsWith('video/') || mime.startsWith('image/'))) {
        return NextResponse.json({ ok: false, error: '対象外のファイルです' }, { status: 403 })
      }
      fileSize = Number(meta.data.size ?? 0)
      verifiedIds.set(fileId, fileSize)
    }

    // 小さいファイルは Google から直接配信（サーバーを経由しないぶん速く・軽く）
    if (fileSize > 0 && fileSize < DIRECT_STREAM_MAX_BYTES) {
      return NextResponse.redirect(
        `https://drive.google.com/uc?export=download&id=${fileId}`,
        302
      )
    }

    const tokenResult = await auth.getAccessToken()
    const token = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token
    if (!token) throw new Error('アクセストークンの取得に失敗しました')

    const range = request.headers.get('range')
    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(range ? { Range: range } : {}),
        },
      }
    )

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { ok: false, error: `取得に失敗しました（HTTP ${upstream.status}）` },
        { status: upstream.status === 404 ? 404 : 502 }
      )
    }

    const headers = new Headers()
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(name)
      if (v) headers.set(name, v)
    }
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes')
    headers.set('cache-control', 'private, max-age=3600')

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (e) {
    console.error('[api/photos/stream]', e)
    return NextResponse.json(
      { ok: false, error: extractGoogleApiMessage(e) },
      { status: 500 }
    )
  }
}
