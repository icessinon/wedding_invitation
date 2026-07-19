import { google } from 'googleapis'
import { getOrCreateChildFolder } from './googleAuth'

/** 既定の保存先: GOOGLE_DRIVE_PHOTOS_FOLDER_ID か、RSVP フォルダ直下のこの名前のフォルダ */
const DEFAULT_PHOTOS_FOLDER_NAME = 'みんなの写真'

const MAX_LIST_PHOTOS = 1000

export type DriveClient = ReturnType<typeof google.drive>

export interface SharedPhoto {
  id: string
  name: string
  uploader: string
  createdTime: string
  kind: 'image' | 'video'
  width: number | null
  height: number | null
  /** 動画の長さ（ms）。画像は null */
  durationMs: number | null
  thumbUrl: string
  viewUrl: string
  downloadUrl: string
}

export function toSharedPhoto(f: {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  createdTime?: string | null
  thumbnailLink?: string | null
  appProperties?: Record<string, string> | null
  imageMediaMetadata?: { width?: number | null; height?: number | null } | null
  videoMediaMetadata?: {
    width?: number | null
    height?: number | null
    durationMillis?: string | null
  } | null
}): SharedPhoto | null {
  const id = f.id
  if (!id) return null
  const isVideo = (f.mimeType ?? '').startsWith('video/')

  // 動画のサムネイルは Drive が生成した thumbnailLink を使う（なければ lh3 を試す）
  const lh3Thumb = `https://lh3.googleusercontent.com/d/${id}=w640`
  const videoThumb = f.thumbnailLink
    ? f.thumbnailLink.replace(/=s\d+[^&]*$/, '=s640')
    : lh3Thumb

  return {
    id,
    name: f.name ?? (isVideo ? 'video' : 'photo'),
    uploader: f.appProperties?.uploader ?? '',
    createdTime: f.createdTime ?? '',
    kind: isVideo ? 'video' : 'image',
    width: (isVideo ? f.videoMediaMetadata?.width : f.imageMediaMetadata?.width) ?? null,
    height: (isVideo ? f.videoMediaMetadata?.height : f.imageMediaMetadata?.height) ?? null,
    durationMs: isVideo && f.videoMediaMetadata?.durationMillis
      ? Number(f.videoMediaMetadata.durationMillis)
      : null,
    thumbUrl: isVideo ? videoThumb : lh3Thumb,
    viewUrl: isVideo
      ? `https://drive.google.com/file/d/${id}/preview`
      : `https://lh3.googleusercontent.com/d/${id}=w1920`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
  }
}

let cachedFolderId: string | null = null

export async function resolvePhotosFolderId(drive: DriveClient): Promise<string> {
  if (cachedFolderId) return cachedFolderId

  const explicit = process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID?.trim()
  if (explicit) {
    cachedFolderId = explicit
    return explicit
  }

  const rsvpFolderId = process.env.GOOGLE_DRIVE_RSVP_FOLDER_ID?.trim()
  if (!rsvpFolderId) {
    throw new Error(
      'GOOGLE_DRIVE_PHOTOS_FOLDER_ID（写真共有用フォルダ）または GOOGLE_DRIVE_RSVP_FOLDER_ID を .env に設定してください'
    )
  }
  const id = await getOrCreateChildFolder(drive, rsvpFolderId, DEFAULT_PHOTOS_FOLDER_NAME)
  cachedFolderId = id
  return id
}

const LIST_FIELDS =
  'nextPageToken, files(id, name, mimeType, createdTime, thumbnailLink, appProperties, imageMediaMetadata(width, height), videoMediaMetadata(width, height, durationMillis))'

/** フォルダ内の画像・動画を新しい順に返す */
export async function listPhotos(drive: DriveClient, folderId: string): Promise<SharedPhoto[]> {
  const photos: SharedPhoto[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
      fields: LIST_FIELDS,
      orderBy: 'createdTime desc',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files ?? []) {
      const p = toSharedPhoto(f)
      if (p) photos.push(p)
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken && photos.length < MAX_LIST_PHOTOS)

  return photos
}
