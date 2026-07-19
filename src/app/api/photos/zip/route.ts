import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { extractGoogleApiMessage, getDriveAuth } from '../../../../lib/googleAuth'
import { listPhotos, resolvePhotosFolderId, type DriveClient, type SharedPhoto } from '../../../../lib/photosDrive'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * みんなの写真を 1 つの ZIP にまとめてストリーミング返却する。
 * 依存を増やさないため、無圧縮（store）の ZIP を自前で組み立てる
 * （JPEG は再圧縮してもほぼ縮まないため store で十分）。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(iso: string): { time: number; date: number } {
  const d = iso ? new Date(iso) : new Date(0)
  const year = Math.max(d.getFullYear(), 1980)
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  return { time, date }
}

interface ZipEntryMeta {
  nameBytes: Buffer
  crc: number
  size: number
  time: number
  date: number
  offset: number
}

function localHeader(e: ZipEntryMeta): Buffer {
  const b = Buffer.alloc(30)
  b.writeUInt32LE(0x04034b50, 0)
  b.writeUInt16LE(20, 4) // version needed
  b.writeUInt16LE(0x0800, 6) // UTF-8 ファイル名
  b.writeUInt16LE(0, 8) // store
  b.writeUInt16LE(e.time, 10)
  b.writeUInt16LE(e.date, 12)
  b.writeUInt32LE(e.crc, 14)
  b.writeUInt32LE(e.size, 18)
  b.writeUInt32LE(e.size, 22)
  b.writeUInt16LE(e.nameBytes.length, 26)
  b.writeUInt16LE(0, 28)
  return b
}

function centralHeader(e: ZipEntryMeta): Buffer {
  const b = Buffer.alloc(46)
  b.writeUInt32LE(0x02014b50, 0)
  b.writeUInt16LE(20, 4) // version made by
  b.writeUInt16LE(20, 6) // version needed
  b.writeUInt16LE(0x0800, 8)
  b.writeUInt16LE(0, 10) // store
  b.writeUInt16LE(e.time, 12)
  b.writeUInt16LE(e.date, 14)
  b.writeUInt32LE(e.crc, 16)
  b.writeUInt32LE(e.size, 20)
  b.writeUInt32LE(e.size, 24)
  b.writeUInt16LE(e.nameBytes.length, 28)
  b.writeUInt16LE(0, 30) // extra
  b.writeUInt16LE(0, 32) // comment
  b.writeUInt16LE(0, 34) // disk
  b.writeUInt16LE(0, 36) // internal attrs
  b.writeUInt32LE(0, 38) // external attrs
  b.writeUInt32LE(e.offset, 42)
  return Buffer.concat([b, e.nameBytes])
}

function endOfCentralDirectory(count: number, cdSize: number, cdOffset: number): Buffer {
  const b = Buffer.alloc(22)
  b.writeUInt32LE(0x06054b50, 0)
  b.writeUInt16LE(0, 4)
  b.writeUInt16LE(0, 6)
  b.writeUInt16LE(count, 8)
  b.writeUInt16LE(count, 10)
  b.writeUInt32LE(cdSize, 12)
  b.writeUInt32LE(cdOffset, 16)
  b.writeUInt16LE(0, 20)
  return b
}

function entryFileName(photo: SharedPhoto, index: number): string {
  // Drive 上の名前から拡張子を推定（なければ .jpg）
  const extMatch = photo.name.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i)
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg'
  const uploader = photo.uploader
    ? `_${photo.uploader.replace(/[/\\?*:|"<>]/g, '_').slice(0, 30)}`
    : ''
  return `${String(index + 1).padStart(3, '0')}${uploader}${ext}`
}

async function* buildZip(drive: DriveClient, photos: SharedPhoto[]): AsyncGenerator<Buffer> {
  const entries: ZipEntryMeta[] = []
  let offset = 0

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    let data: Buffer
    try {
      const res = await drive.files.get(
        { fileId: photo.id, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      )
      data = Buffer.from(res.data as ArrayBuffer)
    } catch (e) {
      // 1枚取得に失敗しても ZIP 全体は続行する
      console.warn('[api/photos/zip] skip', photo.id, extractGoogleApiMessage(e))
      continue
    }

    const { time, date } = dosDateTime(photo.createdTime)
    const entry: ZipEntryMeta = {
      nameBytes: Buffer.from(entryFileName(photo, i), 'utf8'),
      crc: crc32(data),
      size: data.length,
      time,
      date,
      offset,
    }
    entries.push(entry)

    const header = Buffer.concat([localHeader(entry), entry.nameBytes])
    yield header
    yield data
    offset += header.length + data.length
  }

  const cdOffset = offset
  let cdSize = 0
  for (const e of entries) {
    const c = centralHeader(e)
    cdSize += c.length
    yield c
  }
  yield endOfCentralDirectory(entries.length, cdSize, cdOffset)
}

export async function GET() {
  try {
    const drive = google.drive({ version: 'v3', auth: getDriveAuth() })
    const folderId = await resolvePhotosFolderId(drive)
    const photos = await listPhotos(drive, folderId)

    if (photos.length === 0) {
      return NextResponse.json({ ok: false, error: 'まだ写真がありません' }, { status: 404 })
    }

    // 古い順に並べて連番を付ける
    const ordered = [...photos].reverse()
    const iterator = buildZip(drive, ordered)
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next()
          if (done) {
            controller.close()
          } else {
            controller.enqueue(new Uint8Array(value))
          }
        } catch (e) {
          controller.error(e)
        }
      },
      cancel() {
        iterator.return?.(undefined)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="wedding_photos.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[api/photos/zip]', e)
    return NextResponse.json(
      { ok: false, error: extractGoogleApiMessage(e) },
      { status: 500 }
    )
  }
}
