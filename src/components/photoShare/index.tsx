'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './photoShare.module.css'
import { prepareImageForUpload } from './compressImage'
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

interface PendingFile {
  key: string
  file: File
  previewUrl: string
}

export const PhotoShare: React.FC = () => {
  const [photos, setPhotos] = useState<SharedPhoto[] | null>(null)
  const [loadError, setLoadError] = useState('')

  const [uploaderName, setUploaderName] = useState('')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [uploadError, setUploadError] = useState('')
  const [justUploaded, setJustUploaded] = useState(false)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  /** 選択ダウンロード用に選ばれている写真ID */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const galleryTopRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPhotos = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch('/api/photos')
      const json: PhotosApiResponse = await res.json()
      if (!json.ok || !json.photos) {
        throw new Error(json.error || '写真の取得に失敗しました')
      }
      setPhotos(json.photos)
    } catch (e) {
      setPhotos((prev) => prev ?? [])
      setLoadError(e instanceof Error ? e.message : '写真の取得に失敗しました')
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

  const handleFilesChosen = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return
    setUploadError('')
    setJustUploaded(false)
    setPending((prev) => {
      const next = [...prev]
      for (const file of Array.from(list)) {
        if (!file.type.startsWith('image/')) continue
        if (next.length >= MAX_SELECT_FILES) break
        const key = `${file.name}_${file.size}_${file.lastModified}`
        if (next.some((p) => p.key === key)) continue
        next.push({ key, file, previewUrl: URL.createObjectURL(file) })
      }
      return next
    })
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

    try {
      localStorage.setItem(UPLOADER_NAME_KEY, uploaderName.trim())
    } catch {
      // 保存できなくても続行
    }

    const uploaded: SharedPhoto[] = []
    const failed: PendingFile[] = []
    let firstError = ''

    for (const item of pending) {
      try {
        const prepared = await prepareImageForUpload(item.file)
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
        URL.revokeObjectURL(item.previewUrl)
      } catch (e) {
        failed.push(item)
        if (!firstError) {
          firstError = e instanceof Error ? e.message : 'アップロードに失敗しました'
        }
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }))
    }

    if (uploaded.length > 0) {
      setPhotos((prev) => [...uploaded, ...(prev ?? [])])
    }
    setPending(failed)
    if (failed.length > 0) {
      setUploadError(
        `${failed.length}枚のアップロードに失敗しました（${firstError}）。もう一度お試しください。`
      )
    } else {
      setJustUploaded(true)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    setUploading(false)
  }, [uploading, pending, uploaderName])

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const showPrev = useCallback(() => {
    setLightboxIndex((i) => (i === null || !photos?.length ? i : (i - 1 + photos.length) % photos.length))
  }, [photos])
  const showNext = useCallback(() => {
    setLightboxIndex((i) => (i === null || !photos?.length ? i : (i + 1) % photos.length))
  }, [photos])

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

  const lightboxPhoto = useMemo(
    () => (lightboxIndex !== null && photos ? photos[lightboxIndex] : null),
    [lightboxIndex, photos]
  )

  const totalPages = photos ? Math.max(1, Math.ceil(photos.length / PAGE_SIZE)) : 1
  const pagedPhotos = useMemo(
    () => (photos ? photos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : []),
    [photos, page]
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

  const downloadSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds].join(',')
    window.location.href = `/api/photos/zip?ids=${encodeURIComponent(ids)}`
  }, [selectedIds])

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

  return (
    <section className={styles.container}>
      <RisingBubbles count={24} />
      <SectionTitle en="Memories" ja="みんなの写真" />

      <p className={styles.lead}>
        当日の写真をぜひ共有してください
        <br />
        皆様が撮ってくださった一枚一枚が
        <br />
        私たちの宝物になります
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
            スマホから写真を選ぶ
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFilesChosen(e.target.files)}
          />
        </div>

        {pending.length === 0 && !justUploaded && (
          <p className={styles.uploadHint}>
            カメラロールから複数枚まとめて選べます
          </p>
        )}

        {pending.length > 0 && (
          <>
            <div className={styles.previewGrid}>
              {pending.map((p) => (
                <div key={p.key} className={styles.previewItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="" className={styles.previewImage} />
                  {!uploading && (
                    <button
                      type="button"
                      className={styles.previewRemove}
                      aria-label="この写真を取り消す"
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
                : `この${pending.length}枚を共有する`}
            </button>
          </>
        )}

        {uploading && (
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressBar}
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        )}

        {uploadError && <p className={styles.errorText}>{uploadError}</p>}
        {justUploaded && (
          <p className={styles.thanksText}>写真をありがとうございます！ギャラリーに追加しました</p>
        )}
      </div>

      {/* ---- ギャラリー ---- */}
      <div className={styles.galleryHeader} ref={galleryTopRef}>
        <span className={styles.galleryCount}>
          {photos === null ? '' : photos.length > 0 ? `${photos.length}枚の思い出` : ''}
        </span>
        {photos !== null && photos.length > 0 && (
          <a className={styles.bulkDownload} href="/api/photos/zip">
            まとめてダウンロード
          </a>
        )}
      </div>

      {photos === null && (
        <div className={styles.stateBox}>
          <span className={styles.spinner} aria-hidden="true" />
          <p>写真を読み込んでいます…</p>
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

      {photos !== null && !loadError && photos.length === 0 && (
        <div className={styles.stateBox}>
          <p>
            まだ写真がありません
            <br />
            最初の一枚をぜひ共有してください
          </p>
        </div>
      )}

      {photos !== null && photos.length > 0 && (
        <>
          <div className={styles.gallery}>
            {pagedPhotos.map((photo, i) => {
              const globalIndex = page * PAGE_SIZE + i
              const isSelected = selectedIds.has(photo.id)
              return (
                <figure
                  key={photo.id}
                  className={`${styles.galleryItem} ${isSelected ? styles.galleryItemSelected : ''}`}
                >
                  <button
                    type="button"
                    className={styles.galleryButton}
                    onClick={() => openLightbox(globalIndex)}
                    aria-label="写真を拡大表示"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={photo.uploader ? `${photo.uploader}さんの写真` : '当日の写真'}
                      loading="lazy"
                      className={styles.galleryImage}
                      width={photo.width ?? undefined}
                      height={photo.height ?? undefined}
                    />
                  </button>
                  <button
                    type="button"
                    className={`${styles.selectToggle} ${isSelected ? styles.selectToggleOn : ''}`}
                    onClick={() => toggleSelected(photo.id)}
                    aria-label={isSelected ? '選択を外す' : 'この写真を選択'}
                    aria-pressed={isSelected}
                  >
                    ✓
                  </button>
                  {photo.uploader && (
                    <figcaption className={styles.galleryCaption}>{photo.uploader}</figcaption>
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
      {lightboxPhoto && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" onClick={closeLightbox}>
          <div
            className={styles.lightboxInner}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxPhoto.viewUrl} alt="" className={styles.lightboxImage} />
            <div className={styles.lightboxBar}>
              <span className={styles.lightboxCaption}>
                {lightboxPhoto.uploader ? `photo by ${lightboxPhoto.uploader}` : ''}
              </span>
              <a className={styles.lightboxDownload} href={lightboxPhoto.downloadUrl}>
                ダウンロード
              </a>
            </div>
            {photos !== null && photos.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                  onClick={showPrev}
                  aria-label="前の写真"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                  onClick={showNext}
                  aria-label="次の写真"
                >
                  ›
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.lightboxClose}
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
