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
  width: number | null
  height: number | null
  thumbUrl: string
  viewUrl: string
  downloadUrl: string
}

export function toSharedPhoto(f: {
  id?: string | null
  name?: string | null
  createdTime?: string | null
  appProperties?: Record<string, string> | null
  imageMediaMetadata?: { width?: number | null; height?: number | null } | null
}): SharedPhoto | null {
  const id = f.id
  if (!id) return null
  return {
    id,
    name: f.name ?? 'photo',
    uploader: f.appProperties?.uploader ?? '',
    createdTime: f.createdTime ?? '',
    width: f.imageMediaMetadata?.width ?? null,
    height: f.imageMediaMetadata?.height ?? null,
    thumbUrl: `https://lh3.googleusercontent.com/d/${id}=w640`,
    viewUrl: `https://lh3.googleusercontent.com/d/${id}=w1920`,
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

export async function listPhotos(drive: DriveClient, folderId: string): Promise<SharedPhoto[]> {
  const photos: SharedPhoto[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields:
        'nextPageToken, files(id, name, createdTime, appProperties, imageMediaMetadata(width, height))',
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
