/**
 * アップロード前に画像を JPEG に再エンコードして縮小する。
 * - 長辺 2560px / 品質 0.85（閲覧・ダウンロードには十分）
 * - ホスティングのリクエスト上限（Vercel は約 4.5MB）を超えないよう、
 *   仕上がりが 4MB を超える場合はさらに強く縮小し、最終的に 4MB 以下を保証する
 * - HEIC など、そのままではブラウザ表示できない形式も可能なら JPEG に変換する
 * - デコードできない場合、元ファイルが 4MB 以下ならそのまま送り、超える場合はエラー
 */

/** ホスティングのリクエストボディ上限（約4.5MB）に対する安全マージン */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
/** これ以下の JPEG/PNG/WebP は再エンコードせずそのまま送る */
const SKIP_COMPRESS_BYTES = 2 * 1024 * 1024

/** 段階的に強くする縮小設定 */
const ENCODE_PASSES = [
  { maxDimension: 2560, quality: 0.85 },
  { maxDimension: 2048, quality: 0.75 },
  { maxDimension: 1600, quality: 0.65 },
] as const

const WEB_SAFE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type DecodedImage = ImageBitmap | HTMLImageElement

async function decodeImage(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        return await createImageBitmap(file)
      } catch {
        // フォールバックへ
      }
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function sourceSize(source: DecodedImage): { width: number; height: number } {
  if ('naturalWidth' in source) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: source.width, height: source.height }
}

function encodeToJpeg(
  source: DecodedImage,
  maxDimension: number,
  quality: number
): Promise<Blob | null> {
  const { width: srcWidth, height: srcHeight } = sourceSize(source)
  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight))
  const width = Math.max(1, Math.round(srcWidth * scale))
  const height = Math.max(1, Math.round(srcHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(source, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

export interface PreparedUpload {
  blob: Blob
  fileName: string
}

export async function prepareImageForUpload(file: File): Promise<PreparedUpload> {
  const original: PreparedUpload = { blob: file, fileName: file.name }
  const isWebSafe = WEB_SAFE_TYPES.includes(file.type)

  // 小さい Web 表示可能ファイルはそのまま
  if (isWebSafe && file.size <= SKIP_COMPRESS_BYTES) return original

  const source = await decodeImage(file)
  if (!source) {
    // 変換できない形式: 上限内なら原本のまま、超えるなら諦める
    if (file.size <= MAX_UPLOAD_BYTES) return original
    throw new Error(
      `「${file.name}」は形式を変換できず、サイズが大きいため送信できません`
    )
  }

  const { width, height } = sourceSize(source)
  if (!width || !height) {
    if ('close' in source) source.close()
    if (file.size <= MAX_UPLOAD_BYTES) return original
    throw new Error(`「${file.name}」を読み込めませんでした`)
  }

  let best: Blob | null = null
  for (const pass of ENCODE_PASSES) {
    const blob = await encodeToJpeg(source, pass.maxDimension, pass.quality)
    if (!blob) continue
    best = blob
    if (blob.size <= MAX_UPLOAD_BYTES) break
  }
  if ('close' in source) source.close()

  if (!best) {
    if (file.size <= MAX_UPLOAD_BYTES) return original
    throw new Error(`「${file.name}」の変換に失敗しました`)
  }

  // 再エンコードで大きくなってしまったら元のまま（ただし上限内のときだけ）
  if (isWebSafe && best.size >= file.size && file.size <= MAX_UPLOAD_BYTES) {
    return original
  }

  if (best.size > MAX_UPLOAD_BYTES) {
    throw new Error(`「${file.name}」はサイズが大きすぎて送信できません`)
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return { blob: best, fileName: `${base}.jpg` }
}
