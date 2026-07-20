import type { Readable } from 'node:stream'
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
 *
 * メモリにファイルを丸ごと載せない完全ストリーミング方式:
 * CRC とサイズは流しながら計算し、データディスクリプタ（フラグ bit3）で後置する。
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

function crc32Update(crc: number, buf: Uint8Array): number {
  let c = crc
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return c
}

function dosDateTime(iso: string): { time: number; date: number } {
  const d = iso ? new Date(iso) : new Date(0)
  const year = Math.max(d.getFullYear(), 1980)
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  return { time, date }
}

/** UTF-8ファイル名 + データディスクリプタ使用 */
const GP_FLAGS = 0x0808

interface ZipEntryMeta {
  nameBytes: Buffer
  crc: number
  size: number
  time: number
  date: number
  offset: number
}

/** CRC・サイズ未確定（0）で先に出すローカルヘッダ */
function localHeader(nameBytes: Buffer, time: number, date: number): Buffer {
  const b = Buffer.alloc(30)
  b.writeUInt32LE(0x04034b50, 0)
  b.writeUInt16LE(20, 4) // version needed
  b.writeUInt16LE(GP_FLAGS, 6)
  b.writeUInt16LE(0, 8) // store
  b.writeUInt16LE(time, 10)
  b.writeUInt16LE(date, 12)
  b.writeUInt32LE(0, 14) // crc（後置）
  b.writeUInt32LE(0, 18) // comp size（後置）
  b.writeUInt32LE(0, 22) // uncomp size（後置）
  b.writeUInt16LE(nameBytes.length, 26)
  b.writeUInt16LE(0, 28)
  return Buffer.concat([b, nameBytes])
}

/** ファイル本体の直後に置くデータディスクリプタ */
function dataDescriptor(crc: number, size: number): Buffer {
  const b = Buffer.alloc(16)
  b.writeUInt32LE(0x08074b50, 0)
  b.writeUInt32LE(crc, 4)
  b.writeUInt32LE(size, 8)
  b.writeUInt32LE(size, 12)
  return b
}

function centralHeader(e: ZipEntryMeta): Buffer {
  const b = Buffer.alloc(46)
  b.writeUInt32LE(0x02014b50, 0)
  b.writeUInt16LE(20, 4) // version made by
  b.writeUInt16LE(20, 6) // version needed
  b.writeUInt16LE(GP_FLAGS, 8)
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
  const extMatch = photo.name.match(/\.(jpe?g|png|gif|webp|heic|heif|avif)$/i)
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg'
  const uploader = photo.uploader
    ? `_${photo.uploader.replace(/[/\\?*:|"<>]/g, '_').slice(0, 30)}`
    : ''
  return `${String(index + 1).padStart(3, '0')}${uploader}${ext}`
}

async function* buildZip(
  drive: DriveClient,
  photos: SharedPhoto[],
  numberOffset: number
): AsyncGenerator<Buffer> {
  const entries: ZipEntryMeta[] = []
  let offset = 0

  const getStream = (photo: SharedPhoto): Promise<Readable | null> =>
    drive.files
      .get({ fileId: photo.id, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' })
      .then((res) => res.data as Readable)
      .catch((e) => {
        // 1枚取得に失敗しても ZIP 全体は続行する
        console.warn('[api/photos/zip] skip', photo.id, extractGoogleApiMessage(e))
        return null
      })

  // 次のファイルを先読みして、Drive の待ち時間と転送を重ねる
  let nextStream: Promise<Readable | null> = photos.length > 0 ? getStream(photos[0]) : Promise.resolve(null)

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const stream = await nextStream
    nextStream = i + 1 < photos.length ? getStream(photos[i + 1]) : Promise.resolve(null)
    if (!stream) continue

    const { time, date } = dosDateTime(photo.createdTime)
    const nameBytes = Buffer.from(entryFileName(photo, numberOffset + i), 'utf8')
    const header = localHeader(nameBytes, time, date)
    const entryOffset = offset
    yield header
    offset += header.length

    // メモリに溜めず、流しながら CRC とサイズを計算する
    let crc = 0xffffffff
    let size = 0
    for await (const chunk of stream) {
      const buf = chunk as Buffer
      crc = crc32Update(crc, buf)
      size += buf.length
      yield buf
    }
    const finalCrc = (crc ^ 0xffffffff) >>> 0

    const desc = dataDescriptor(finalCrc, size)
    yield desc
    offset += size + desc.length

    entries.push({ nameBytes, crc: finalCrc, size, time, date, offset: entryOffset })
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

/** ?ids=... で選択された写真だけの ZIP を作れる（最大200件） */
const MAX_SELECTED_IDS = 200
/** 一括ダウンロードの1パートあたりの枚数（実行時間・メモリを確実に収めるため） */
const PART_SIZE = 100

export async function GET(request: Request) {
  try {
    const drive = google.drive({ version: 'v3', auth: getDriveAuth() })
    const folderId = await resolvePhotosFolderId(drive)
    // 動画はサイズ・時間的に ZIP へ入れない（写真のみ）
    let photos = (await listPhotos(drive, folderId)).filter((p) => p.kind === 'image')

    const params = new URL(request.url).searchParams

    // 選択ダウンロード: フォルダ内に実在する ID だけに絞る（それ以外は無視）
    const idsParam = params.get('ids')
    if (idsParam) {
      const wanted = new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_SELECTED_IDS))
      photos = photos.filter((p) => wanted.has(p.id))
    }

    // 古い順に並べて連番を付ける
    let ordered = [...photos].reverse()

    // 一括は ?part=1,2,... で100枚ずつに分割（枚数が多いと1本のZIPでは時間切れになるため）
    const part = parseInt(params.get('part') ?? '0', 10)
    let numberOffset = 0
    let fileName = 'wedding_photos.zip'
    if (!idsParam && part >= 1) {
      numberOffset = (part - 1) * PART_SIZE
      ordered = ordered.slice(numberOffset, part * PART_SIZE)
      fileName = `wedding_photos_${part}.zip`
    }

    if (ordered.length === 0) {
      return NextResponse.json({ ok: false, error: '対象の写真がありません' }, { status: 404 })
    }

    const iterator = buildZip(drive, ordered, numberOffset)
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
        'Content-Disposition': `attachment; filename="${fileName}"`,
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
