'use client'

import React, { useEffect, useRef, useState } from 'react'
import styles from './oceanMemories.module.css'
import { LightRays, FishSchool, RisingBubbles, SailingHorizon } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'
import type { PhotosApiResponse } from '../photoShare/types'

/** 使うゲスト写真の最大数 */
const MAX_PHOTOS = 60
/** 1枚が入れ替わる間隔（ms） */
const SWAP_INTERVAL = 4200
/** フェードアウトにかける時間（ms）— CSS の transition と合わせる */
const FADE_MS = 1200

interface DriftPhoto {
  url: string
  uploader: string
}

/** アルバムのように散りばめる配置（%座標・傾き・サイズ・重なり） */
const SLOTS = [
  { left: '2%', top: '2%', rot: -7, size: 'sizeL', z: 3 },
  { left: '58%', top: '6%', rot: 6, size: 'sizeM', z: 2 },
  { left: '38%', top: '0%', rot: 3, size: 'sizeS', z: 1 },
  { left: '42%', top: '30%', rot: 5, size: 'sizeL', z: 4 },
  { left: '2%', top: '38%', rot: -5, size: 'sizeM', z: 2 },
  { left: '74%', top: '36%', rot: -8, size: 'sizeS', z: 3 },
  { left: '16%', top: '63%', rot: 7, size: 'sizeM', z: 3 },
  { left: '58%', top: '66%', rot: -4, size: 'sizeS', z: 2 },
] as const

export const OceanMemories: React.FC = () => {
  const [photos, setPhotos] = useState<DriftPhoto[]>([])
  /** 各スロットに表示している写真のインデックス */
  const [slotAssign, setSlotAssign] = useState<number[]>(SLOTS.map((_, i) => i))
  /** いまフェードアウト中のスロット */
  const [hiddenSlot, setHiddenSlot] = useState(-1)
  const nextIndexRef = useRef(SLOTS.length)
  const tickSlotRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/photos')
      .then((res) => res.json())
      .then((json: PhotosApiResponse) => {
        if (cancelled || !json.ok || !json.photos) return
        setPhotos(
          json.photos
            .slice(0, MAX_PHOTOS)
            .map((p) => ({ url: p.thumbUrl, uploader: p.uploader }))
        )
      })
      .catch(() => {
        // 取得できない場合はセクションごと非表示のまま
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 一定間隔で1枚ずつ「消えて → 別の写真が現れる」
  useEffect(() => {
    if (photos.length <= 1) return
    let fadeTimer: number | undefined
    const interval = window.setInterval(() => {
      const slot = tickSlotRef.current % SLOTS.length
      tickSlotRef.current++

      const nextIndex = nextIndexRef.current % photos.length
      nextIndexRef.current++
      // フェードイン時にちらつかないよう先読み
      new Image().src = photos[nextIndex].url

      setHiddenSlot(slot)
      fadeTimer = window.setTimeout(() => {
        setSlotAssign((prev) => {
          const next = [...prev]
          next[slot] = nextIndex
          return next
        })
        setHiddenSlot(-1)
      }, FADE_MS)
    }, SWAP_INTERVAL)
    return () => {
      window.clearInterval(interval)
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
    }
  }, [photos])

  // 当日の写真がまだないときは何も出さない
  if (photos.length === 0) return null

  return (
    <section className={styles.container}>
      <LightRays />
      <RisingBubbles count={40} />

      <SectionTitle en="Album" ja="皆様と過ごした 大切な一日" />

      <SailingHorizon />

      <div className={styles.stage}>
        {SLOTS.map((slot, i) => {
          const photo = photos[(slotAssign[i] ?? i) % photos.length]
          return (
            <div
              key={i}
              className={`${styles.slot} ${styles[slot.size]} ${
                hiddenSlot === i ? styles.slotHidden : ''
              }`}
              style={
                {
                  left: slot.left,
                  top: slot.top,
                  zIndex: slot.z,
                  '--rot': `${slot.rot}deg`,
                  '--bob-delay': `-${i * 1.3}s`,
                } as React.CSSProperties
              }
            >
              <div className={styles.slotCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={styles.slotImage}
                />
                {photo.uploader && (
                  <span className={styles.cardCaption}>{photo.uploader}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <FishSchool />
    </section>
  )
}
