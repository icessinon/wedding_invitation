'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './photoShare.module.css'
import { prepareImageForUpload } from './compressImage'
import { reportError } from '../../lib/reportError'
import { ExternalBrowserNotice } from './ExternalBrowserNotice'
import { RisingBubbles } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'
import type { PhotosApiResponse, SharedPhoto } from './types'

const MAX_SELECT_FILES = 30
const UPLOADER_NAME_KEY = 'photo_uploader_name'
/** 1ページに表示する枚数 */
const PAGE_SIZE = 24
/** 選択ダウンロードの上限（URL長対策） */
const MAX_SELECT_DOWNLOAD = 100
/** スワイプ判定のしきい値（px） */
const SWIPE_THRESHOLD = 48
/** 動画の上限サイズ（iPhoneの4K長尺も収まる） */
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024
/** 直接アップロードに回す画像の上限（RAW等の大きい写真も可） */
const MAX_IMAGE_BYTES = 100 * 1024 * 1024

type Tab = 'image' | 'video'

interface PendingFile {
  key: string
  file: File
  previewUrl: string
  isVideo: boolean
}

/** type が空でも拡張子で写真/動画を判定できるようにする */
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'hif', 'avif', 'bmp', 'tiff', 'tif', 'dng', 'arw', 'cr2', 'cr3', 'nef', 'orf', 'rw2', 'raf', 'jfif']
const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', '3gp', 'mts', 'wmv']

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  hif: 'image/heif', avif: 'image/avif', bmp: 'image/bmp', tiff: 'image/tiff',
  tif: 'image/tiff', dng: 'image/x-adobe-dng', arw: 'image/x-sony-arw',
  cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3', nef: 'image/x-nikon-nef',
  orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2', raf: 'image/x-fuji-raf',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska', '3gp': 'video/3gpp',
  mts: 'video/mp2t', wmv: 'video/x-ms-wmv',
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function classifyFile(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  const ext = extOf(file.name)
  if (VIDEO_EXTS.includes(ext)) return 'video'
  if (IMAGE_EXTS.includes(ext)) return 'image'
  return null
}

/** Drive に渡す MIME（一覧の image/video 判定にも使われるため必ず補完する） */
function mimeFor(file: File, kind: 'image' | 'video'): string {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return file.type
  return MIME_BY_EXT[extOf(file.name)] ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 再開可能アップロードの1回分の PUT（offset から最後まで） */
function putChunk(
  url: string,
  file: File,
  offset: number,
  onProgress: (fraction: number) => void
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    if (offset > 0) {
      xhr.setRequestHeader('Content-Range', `bytes ${offset}-${file.size - 1}/${file.size}`)
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((offset + e.loaded) / file.size)
    }
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(offset > 0 ? file.slice(offset) : file)
  })
}

/**
 * Drive の再開可能アップロード。
 * 途中で通信が切れても状態を確認して続きから送り、
 * 「実はサーバー側では完了していた」場合も成功として扱う。
 */
async function uploadVideoResumable(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<{ id?: string }> {
  let offset = 0
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await putChunk(url, file, offset, onProgress)
      if (r.status >= 200 && r.status < 300) return JSON.parse(r.body)
    } catch {
      // 通信断 → 状態確認へ
    }
    await sleep(1500)
    // アップロードがどこまで届いたかをセッションに問い合わせる
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes */${file.size}` },
      })
      if (res.status >= 200 && res.status < 300) {
        // 実は完了していた
        return JSON.parse(await res.text())
      }
      if (res.status === 308) {
        const range = res.headers.get('Range')
        offset = range ? parseInt(range.split('-')[1], 10) + 1 : 0
        continue
      }
      if (res.status >= 400) break // セッション失効
    } catch {
      // 状態確認も失敗 → そのまま再試行
    }
  }
  throw new Error('動画の送信に失敗しました。電波の良い場所でもう一度お試しください')
}

/** 仕上げ（公開権限の付与）。一時的な失敗に備えてリトライする */
async function finalizeWithRetry(fileId: string): Promise<PhotosApiResponse> {
  let lastError = ''
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('/api/photos/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      const json: PhotosApiResponse = await res.json()
      if (json.ok && json.photos?.length) return json
      lastError = json.error ?? ''
    } catch (e) {
      lastError = e instanceof Error ? e.message : ''
    }
    await sleep(1200 * (i + 1))
  }
  throw new Error(lastError || '共有設定に失敗しました')
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return ''
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))}MB`
}

export const PhotoShare: React.FC = () => {
  const [photos, setPhotos] = useState<SharedPhoto[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  /** まとめて/選択ダウンロード開始のフィードバック */
  const [zipStarted, setZipStarted] = useState(false)

  const [uploaderName, setUploaderName] = useState('')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [fileProgress, setFileProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [justUploaded, setJustUploaded] = useState(false)
  const [uploadedHadVideo, setUploadedHadVideo] = useState(false)
  /** ネイティブ再生に失敗したとき Drive プレイヤーへ切替 */
  const [videoFallback, setVideoFallback] = useState(false)

  const [tab, setTab] = useState<Tab>('image')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  /** 選択ダウンロード用に選ばれている写真ID */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const galleryTopRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPhotos = useCallback(async () => {
    setLoadError('')
    setRefreshing(true)
    try {
      const res = await fetch('/api/photos')
      const json: PhotosApiResponse = await res.json()
      if (!json.ok || !json.photos) {
        throw new Error(json.error || '写真の取得に失敗しました')
      }
      setPhotos(json.photos)
    } catch (e) {
      setPhotos((prev) => prev ?? [])
      const msg = e instanceof Error ? e.message : '写真の取得に失敗しました'
      setLoadError(msg)
      reportError('ギャラリー読み込み失敗', msg)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(UPLOADER_NAME_KEY)
      if (saved) setUploaderName(saved)
    } catch {
      // localStorage が使えない環境では無視
    }
  }, [])

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
    // アンマウント時のみ解放
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // アップロード中にページを閉じようとしたら確認を出す
  useEffect(() => {
    if (!uploading) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploading])

  // ライトボックスの対象が変わったらフォールバック状態をリセット
  useEffect(() => {
    setVideoFallback(false)
  }, [lightboxIndex])

  const images = useMemo(() => (photos ?? []).filter((p) => p.kind !== 'video'), [photos])
  const videos = useMemo(() => (photos ?? []).filter((p) => p.kind === 'video'), [photos])
  const currentList = tab === 'image' ? images : videos

  const switchTab = useCallback((next: Tab) => {
    setTab(next)
    setPage(0)
    setLightboxIndex(null)
  }, [])

  const handleFilesChosen = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return
    setUploadError('')
    setJustUploaded(false)
    let tooBig = 0
    let unknown = 0
    setPending((prev) => {
      const next = [...prev]
      for (const file of Array.from(list)) {
        const kind = classifyFile(file)
        if (!kind) {
          unknown++
          continue
        }
        const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
        if (file.size > maxBytes) {
          tooBig++
          continue
        }
        if (next.length >= MAX_SELECT_FILES) break
        const key = `${file.name}_${file.size}_${file.lastModified}`
        if (next.some((p) => p.key === key)) continue
        next.push({ key, file, previewUrl: URL.createObjectURL(file), isVideo: kind === 'video' })
      }
      return next
    })
    const notes: string[] = []
    if (tooBig > 0) notes.push(`${tooBig}件はサイズ上限（動画${formatBytes(MAX_VIDEO_BYTES)}・写真${formatBytes(MAX_IMAGE_BYTES)}）を超えているため外しました`)
    if (unknown > 0) notes.push(`${unknown}件は写真・動画として認識できずスキップしました`)
    if (notes.length > 0) setUploadError(notes.join('。'))
  }, [])

  const removePending = useCallback((key: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.key === key)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.key !== key)
    })
  }, [])

  const handleUpload = useCallback(async () => {
    if (uploading || pending.length === 0) return
    setUploading(true)
    setUploadError('')
    setJustUploaded(false)
    setProgress({ done: 0, total: pending.length })
    setFileProgress(0)

    try {
      localStorage.setItem(UPLOADER_NAME_KEY, uploaderName.trim())
    } catch {
      // 保存できなくても続行
    }

    const uploaded: SharedPhoto[] = []
    const failed: PendingFile[] = []
    let firstError = ''

    // Drive への直接アップロード（動画と、変換できない/大きい写真が通る）
    const uploadDirect = async (item: PendingFile, kind: 'image' | 'video') => {
      const sessRes = await fetch('/api/photos/upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: item.file.name,
          mimeType: mimeFor(item.file, kind),
          size: item.file.size,
          uploaderName: uploaderName.trim(),
        }),
      })
      const sess = await sessRes.json()
      if (!sess.ok || !sess.uploadUrl) {
        throw new Error(sess.error || 'アップロードの準備に失敗しました')
      }
      const created = await uploadVideoResumable(sess.uploadUrl, item.file, setFileProgress)
      if (!created.id) throw new Error('アップロード結果を取得できませんでした')
      const fin = await finalizeWithRetry(created.id)
      return fin.photos ?? []
    }

    for (const item of pending) {
      setFileProgress(0)
      try {
        if (item.isVideo) {
          uploaded.push(...(await uploadDirect(item, 'video')))
        } else {
          const prepared = await prepareImageForUpload(item.file)
          if (!prepared) {
            // 変換できない・4MBに収まらない写真は Drive へ直接
            uploaded.push(...(await uploadDirect(item, 'image')))
          } else {
            const fd = new FormData()
            fd.set('uploaderName', uploaderName.trim())
            fd.append('photo', prepared.blob, prepared.fileName)
            const res = await fetch('/api/photos', { method: 'POST', body: fd })
            let json: PhotosApiResponse | null = null
            try {
              json = await res.json()
            } catch {
              // ホスティング側のエラー（413等）は JSON でないことがある
            }
            if (!res.ok || !json?.ok || !json.photos?.length) {
              const fallback =
                res.status === 413
                  ? '画像サイズが大きすぎます'
                  : `送信に失敗しました（HTTP ${res.status}）`
              throw new Error(json?.error || fallback)
            }
            uploaded.push(...json.photos)
          }
        }
        URL.revokeObjectURL(item.previewUrl)
      } catch (e) {
        failed.push(item)
        if (!firstError) {
          firstError = e instanceof Error ? e.message : 'アップロードに失敗しました'
        }
      }
      setFileProgress(1)
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }))
    }

    if (uploaded.length > 0) {
      setPhotos((prev) => [...uploaded, ...(prev ?? [])])
      setUploadedHadVideo(uploaded.some((p) => p.kind === 'video'))
    }
    setPending(failed)
    if (failed.length > 0) {
      setUploadError(
        `${failed.length}件のアップロードに失敗しました（${firstError}）。もう一度お試しください。`
      )
      reportError(
        'アップロード失敗',
        `${failed.length}件失敗（成功${uploaded.length}件）: ${firstError} / 例: ${failed[0]?.file.name ?? ''} ${Math.round((failed[0]?.file.size ?? 0) / 1024 / 1024)}MB`
      )
    } else {
      setJustUploaded(true)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    // 投稿した種類のタブ・先頭ページに切り替えて、自分の投稿がすぐ見えるようにする
    if (uploaded.length > 0) {
      setTab(uploaded.some((p) => p.kind !== 'video') ? 'image' : 'video')
      setPage(0)
    }
    setUploading(false)
  }, [uploading, pending, uploaderName])

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const showPrev = useCallback(() => {
    setLightboxIndex((i) =>
      i === null || currentList.length === 0 ? i : (i - 1 + currentList.length) % currentList.length
    )
  }, [currentList])
  const showNext = useCallback(() => {
    setLightboxIndex((i) =>
      i === null || currentList.length === 0 ? i : (i + 1) % currentList.length
    )
  }, [currentList])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxIndex, closeLightbox, showPrev, showNext])

  const lightboxItem = useMemo(
    () => (lightboxIndex !== null ? currentList[lightboxIndex] ?? null : null),
    [lightboxIndex, currentList]
  )

  /** 動画の縦横比に合わせてプレイヤー枠をできるだけ大きくする */
  const videoFrameStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!lightboxItem || lightboxItem.kind !== 'video') return undefined
    const w = lightboxItem.width
    const h = lightboxItem.height
    if (!w || !h) return undefined // 比率不明のときは CSS の大きめの枠のまま
    const portrait = h > w
    return portrait
      ? { aspectRatio: `${w} / ${h}`, height: 'min(74svh, 840px)', width: 'auto', maxWidth: '94vw' }
      : { aspectRatio: `${w} / ${h}`, width: 'min(94vw, 920px)', height: 'auto', maxHeight: '74svh' }
  }, [lightboxItem])

  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE))
  const pagedItems = useMemo(
    () => currentList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [currentList, page]
  )

  const changePage = useCallback(
    (next: number) => {
      setPage(Math.min(Math.max(0, next), totalPages - 1))
      galleryTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [totalPages]
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < MAX_SELECT_DOWNLOAD) {
        next.add(id)
      }
      return next
    })
  }, [])

  const showZipToast = useCallback(() => {
    setZipStarted(true)
    window.setTimeout(() => setZipStarted(false), 7000)
  }, [])

  const downloadSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds].join(',')
    window.location.href = `/api/photos/zip?ids=${encodeURIComponent(ids)}`
    setSelectedIds(new Set())
    showZipToast()
  }, [selectedIds, showZipToast])

  // 隣の写真を先読みして、スワイプ時に待たせない
  useEffect(() => {
    if (lightboxIndex === null || currentList.length < 2) return
    for (const offset of [1, -1]) {
      const neighbor =
        currentList[(lightboxIndex + offset + currentList.length) % currentList.length]
      if (neighbor && neighbor.kind !== 'video') {
        new Image().src = neighbor.viewUrl
      }
    }
  }, [lightboxIndex, currentList])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      touchStartRef.current = null
      const t = e.changedTouches[0]
      if (!start || !t) return
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
      if (dx > 0) {
        showPrev()
      } else {
        showNext()
      }
    },
    [showPrev, showNext]
  )

  const overallProgress =
    progress.total > 0 ? ((progress.done + Math.min(fileProgress, 0.99)) / progress.total) * 100 : 0

  return (
    <section className={styles.container}>
      <RisingBubbles count={24} />
      <ExternalBrowserNotice />
      <SectionTitle en="Memories" ja="みんなの写真" />

      <p className={styles.lead}>
        当日の写真や動画をぜひ共有してください
        <br />
        皆様が残してくださった一枚一枚が
        <br />
        私たちの宝物になります
      </p>

      <p className={styles.updateNote}>
        <span aria-hidden="true">✦</span> カメラマンの写真も 8月頃 追加予定
      </p>

      {/* ---- 投稿パネル ---- */}
      <div className={styles.uploadPanel}>
        <div className={styles.uploadRow}>
          <input
            type="text"
            className={styles.nameInput}
            placeholder="お名前（任意）"
            value={uploaderName}
            maxLength={60}
            onChange={(e) => setUploaderName(e.target.value)}
            disabled={uploading}
          />
          <button
            type="button"
            className={styles.selectButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            スマホから写真・動画を選ぶ
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.heic,.heif,.hif,.avif,.dng,.arw,.cr2,.cr3,.nef,.orf,.rw2,.raf,.mov,.m4v,.3gp"
            multiple
            hidden
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
        </div>

        {pending.length === 0 && !justUploaded && (
          <p className={styles.uploadHint}>
            カメラロールから複数まとめて選べます（動画もOK）
          </p>
        )}

        {pending.length > 0 && (
          <>
            <div className={styles.previewGrid}>
              {pending.map((p) => (
                <div key={p.key} className={styles.previewItem}>
                  {p.isVideo ? (
                    <div className={styles.previewVideo}>
                      <span className={styles.previewVideoIcon} aria-hidden="true">▶</span>
                      <span className={styles.previewVideoSize}>{formatBytes(p.file.size)}</span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.previewUrl} alt="" className={styles.previewImage} />
                  )}
                  {!uploading && (
                    <button
                      type="button"
                      className={styles.previewRemove}
                      aria-label="これを取り消す"
                      onClick={() => removePending(p.key)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading
                ? `送信中… ${Math.min(progress.done + 1, progress.total)} / ${progress.total}`
                : `この${pending.length}件を共有する`}
            </button>
          </>
        )}

        {uploading && (
          <>
            <div className={styles.progressTrack} aria-hidden="true">
              <div className={styles.progressBar} style={{ width: `${overallProgress}%` }} />
            </div>
            {pending.some((p) => p.isVideo) && (
              <p className={styles.uploadHint}>
                動画の送信には数分かかることがあります
                <br />
                送信が終わるまでこの画面を閉じずにお待ちください
              </p>
            )}
          </>
        )}

        {uploadError && <p className={styles.errorText}>{uploadError}</p>}
        {justUploaded && (
          <p className={styles.thanksText}>
            ありがとうございます！ギャラリーに追加しました
            {uploadedHadVideo && (
              <>
                <br />
                <span className={styles.thanksSub}>
                  動画のサムネイル表示には数分かかることがあります
                </span>
              </>
            )}
          </p>
        )}
      </div>

      {/* ---- タブ ---- */}
      <div className={styles.tabs} ref={galleryTopRef}>
        <button
          type="button"
          className={`${styles.tabButton} ${tab === 'image' ? styles.tabButtonOn : ''}`}
          onClick={() => switchTab('image')}
        >
          写真{photos !== null ? `（${images.length}）` : ''}
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${tab === 'video' ? styles.tabButtonOn : ''}`}
          onClick={() => switchTab('video')}
        >
          動画{photos !== null ? `（${videos.length}）` : ''}
        </button>
      </div>

      {/* ---- ギャラリー ---- */}
      <div className={styles.galleryHeader}>
        <span className={styles.galleryCountGroup}>
          <span className={styles.galleryCount}>
            {tab === 'image' && images.length > 0 ? `${images.length}枚の思い出` : ''}
            {tab === 'video' && videos.length > 0 ? `${videos.length}本の思い出` : ''}
          </span>
          {photos !== null && (
            <button
              type="button"
              className={styles.refreshButton}
              onClick={loadPhotos}
              disabled={refreshing}
              aria-label="一覧を更新"
            >
              {refreshing ? '更新中…' : '↻ 更新'}
            </button>
          )}
        </span>
        {tab === 'image' && images.length > 0 && (
          <a className={styles.bulkDownload} href="/api/photos/zip" onClick={showZipToast}>
            まとめてダウンロード
          </a>
        )}
      </div>

      {tab === 'image' && images.length > 50 && (
        <p className={styles.zipNote}>
          ※まとめてダウンロードは容量が大きいため Wi-Fi でのご利用がおすすめです
        </p>
      )}

      {photos === null && (
        <div className={styles.gallery} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={styles.skeleton}
              style={{ height: 110 + ((i * 47) % 90) }}
            />
          ))}
        </div>
      )}

      {photos !== null && loadError && (
        <div className={styles.stateBox}>
          <p className={styles.errorText}>{loadError}</p>
          <button type="button" className={styles.retryButton} onClick={loadPhotos}>
            再読み込み
          </button>
        </div>
      )}

      {photos !== null && !loadError && currentList.length === 0 && (
        <div className={styles.stateBox}>
          {tab === 'image' ? (
            <p>
              まだ写真がありません
              <br />
              最初の一枚をぜひ共有してください
            </p>
          ) : (
            <p>
              まだ動画がありません
              <br />
              動画もぜひ共有してください
            </p>
          )}
        </div>
      )}

      {currentList.length > 0 && (
        <>
          <div className={styles.gallery}>
            {pagedItems.map((item, i) => {
              const globalIndex = page * PAGE_SIZE + i
              const isVideo = item.kind === 'video'
              const isSelected = selectedIds.has(item.id)
              return (
                <figure
                  key={item.id}
                  className={`${styles.galleryItem} ${isSelected ? styles.galleryItemSelected : ''}`}
                >
                  <button
                    type="button"
                    className={styles.galleryButton}
                    onClick={() => openLightbox(globalIndex)}
                    aria-label={isVideo ? '動画を再生' : '写真を拡大表示'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbUrl.replace('=w640', '=w480').replace('=s640', '=s480')}
                      alt={item.uploader ? `${item.uploader}さんの${isVideo ? '動画' : '写真'}` : ''}
                      loading="lazy"
                      className={styles.galleryImage}
                      width={item.width ?? undefined}
                      height={item.height ?? undefined}
                      onError={(e) => {
                        // サムネイル生成前の動画などは黒地+▶で表示
                        e.currentTarget.style.visibility = 'hidden'
                      }}
                    />
                    {isVideo && (
                      <span className={styles.playOverlay} aria-hidden="true">
                        <span className={styles.playIcon}>▶</span>
                        {item.durationMs ? (
                          <span className={styles.durationBadge}>
                            {formatDuration(item.durationMs)}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </button>
                  {!isVideo && (
                    <button
                      type="button"
                      className={`${styles.selectToggle} ${isSelected ? styles.selectToggleOn : ''}`}
                      onClick={() => toggleSelected(item.id)}
                      aria-label={isSelected ? '選択を外す' : 'この写真を選択'}
                      aria-pressed={isSelected}
                    >
                      ✓
                    </button>
                  )}
                  {item.uploader && (
                    <figcaption className={styles.galleryCaption}>{item.uploader}</figcaption>
                  )}
                </figure>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pagerButton}
                onClick={() => changePage(page - 1)}
                disabled={page === 0}
                aria-label="前のページ"
              >
                ‹
              </button>
              <span className={styles.pagerLabel}>
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.pagerButton}
                onClick={() => changePage(page + 1)}
                disabled={page >= totalPages - 1}
                aria-label="次のページ"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}

      {/* ---- ZIPダウンロード開始のトースト ---- */}
      {zipStarted && (
        <div className={styles.zipToast} role="status">
          ZIPを作成しています… まもなくダウンロードが始まります
        </div>
      )}

      {/* ---- 選択ダウンロードの追従バー ---- */}
      {selectedIds.size > 0 && (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>{selectedIds.size}枚選択中</span>
          <button type="button" className={styles.selectionSave} onClick={downloadSelected}>
            保存する
          </button>
          <button
            type="button"
            className={styles.selectionClear}
            onClick={() => setSelectedIds(new Set())}
          >
            解除
          </button>
        </div>
      )}

      {/* ---- ライトボックス ---- */}
      {lightboxItem && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" onClick={closeLightbox}>
          <div
            className={styles.lightboxInner}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {lightboxItem.kind === 'video' ? (
              videoFallback ? (
                // ネイティブ再生できない形式は Drive のプレイヤーで再生（変換してくれる）
                <iframe
                  src={`https://drive.google.com/file/d/${lightboxItem.id}/preview`}
                  className={styles.lightboxVideo}
                  style={videoFrameStyle}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  title="動画の再生"
                />
              ) : (
                <video
                  key={lightboxItem.id}
                  src={`/api/photos/stream/${lightboxItem.id}`}
                  className={styles.lightboxVideo}
                  style={videoFrameStyle}
                  controls
                  playsInline
                  autoPlay
                  preload="metadata"
                  poster={lightboxItem.thumbUrl}
                  onError={() => {
                    setVideoFallback(true)
                    reportError('動画再生（プレイヤー切替）', `id=${lightboxItem.id} ${lightboxItem.name}`)
                  }}
                />
              )
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightboxItem.viewUrl}
                alt=""
                className={styles.lightboxImage}
                style={{
                  // 高解像度版の読み込み中はサムネイルを下敷きにして待たせない
                  backgroundImage: `url(${lightboxItem.thumbUrl})`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}
            <div className={styles.lightboxBar}>
              {lightboxItem.kind === 'video' && currentList.length > 1 && (
                <button type="button" className={styles.barNav} onClick={showPrev} aria-label="前へ">
                  ‹
                </button>
              )}
              <span className={styles.lightboxCaption}>
                {lightboxItem.uploader ? `by ${lightboxItem.uploader}` : ''}
              </span>
              <a className={styles.lightboxDownload} href={lightboxItem.downloadUrl}>
                ダウンロード
              </a>
              {lightboxItem.kind === 'video' && currentList.length > 1 && (
                <button type="button" className={styles.barNav} onClick={showNext} aria-label="次へ">
                  ›
                </button>
              )}
            </div>
            {lightboxItem.kind !== 'video' && (
              <p className={styles.lightboxHint}>写真を長押しすると端末に保存できます</p>
            )}
            {/* 写真のときだけ左右の矢印を重ねる（動画はプレイヤーの操作と被るためバー側に） */}
            {lightboxItem.kind !== 'video' && currentList.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                  onClick={showPrev}
                  aria-label="前へ"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                  onClick={showNext}
                  aria-label="次へ"
                >
                  ›
                </button>
              </>
            )}
            <button
              type="button"
              className={`${styles.lightboxClose} ${
                lightboxItem.kind === 'video' ? styles.lightboxCloseVideo : ''
              }`}
              onClick={closeLightbox}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
