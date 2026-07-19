'use client'

import React, { useEffect, useRef, useState } from 'react'
import styles from './oceanMemories.module.css'
import { LightRays, FishSchool, RisingBubbles, SailingHorizon } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'
import type { PhotosApiResponse } from '../photoShare/types'

/** 使うゲスト写真の最大数 */
const MAX_PHOTOS = 60
/** フェードの時間（ms）— CSS の transition と合わせる */
const FADE_MS = 1200
/** 同時に見える枚数の上限（下は寿命と出現ペースの揺らぎで自然に変動する） */
const MAX_VISIBLE = 9
/** 最初にばらまく枚数 */
const INITIAL_COUNT = 6
/** 1枚の表示寿命（ms）: 8〜16秒でランダム */
const LIFETIME_MIN = 8000
const LIFETIME_RANGE = 8000
/** 新しい写真が置かれる間隔（ms）: 0.7〜2.5秒でランダム */
const SPAWN_MIN = 700
const SPAWN_RANGE = 1800

interface DriftPhoto {
  url: string
  uploader: string
}

interface Placed {
  key: number
  photoIndex: number
  /** ステージ内の位置（%） */
  left: number
  top: number
  rot: number
  sizeClass: 'sizeL' | 'sizeM' | 'sizeS'
  /** 幅（ステージに対する%）— 重なり判定に使う */
  w: number
  z: number
  visible: boolean
}

const SIZE_DEFS = [
  { cls: 'sizeL', w: 44 },
  { cls: 'sizeM', w: 34 },
  { cls: 'sizeS', w: 26 },
] as const

function pickSize() {
  const r = Math.random()
  if (r < 0.3) return SIZE_DEFS[0]
  if (r < 0.7) return SIZE_DEFS[1]
  return SIZE_DEFS[2]
}

export const OceanMemories: React.FC = () => {
  const [photos, setPhotos] = useState<DriftPhoto[]>([])
  const [placed, setPlaced] = useState<Placed[]>([])
  const placedRef = useRef<Placed[]>([])
  const keyRef = useRef(0)
  const zRef = useRef(1)
  const nextIndexRef = useRef(0)
  const timersRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    placedRef.current = placed
  }, [placed])

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

  // ランダムな場所に写真が生まれ、寿命が来たら消えていくループ
  useEffect(() => {
    if (photos.length === 0) return

    // 表示に使うサムネイルを先読みしておく（フェードイン時の白抜け防止）
    photos.slice(0, 20).forEach((p) => {
      new Image().src = p.url
    })

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timersRef.current.delete(id)
        fn()
      }, ms)
      timersRef.current.add(id)
    }

    const spawn = () => {
      if (placedRef.current.length >= MAX_VISIBLE) return

      const size = pickSize()
      // 数か所の候補から、既存の写真から一番離れた場所を選ぶ（固まりすぎ防止）
      const existing = placedRef.current
      let best = { left: Math.random() * (96 - size.w), top: Math.random() * (96 - size.w) }
      let bestScore = -1
      for (let t = 0; t < 6; t++) {
        const c = {
          left: Math.random() * (96 - size.w),
          top: Math.random() * Math.max(4, 96 - size.w * 0.95),
        }
        const cx = c.left + size.w / 2
        const cy = c.top + size.w * 0.45
        let minD = 200
        for (const p of existing) {
          const px = p.left + p.w / 2
          const py = p.top + p.w * 0.45
          minD = Math.min(minD, Math.hypot(cx - px, cy - py))
        }
        if (minD > bestScore) {
          bestScore = minD
          best = c
        }
      }

      const photoIndex = nextIndexRef.current % photos.length
      nextIndexRef.current++
      // フェードイン時にちらつかないよう先読み
      new Image().src = photos[photoIndex].url

      const item: Placed = {
        key: ++keyRef.current,
        photoIndex,
        left: best.left,
        top: best.top,
        rot: (Math.random() - 0.5) * 16,
        sizeClass: size.cls,
        w: size.w,
        z: ++zRef.current, // あとから置かれた写真ほど前へ
        visible: false,
      }

      setPlaced((prev) => [...prev, item])
      later(() => {
        setPlaced((prev) => prev.map((p) => (p.key === item.key ? { ...p, visible: true } : p)))
      }, 50)

      const lifetime = LIFETIME_MIN + Math.random() * LIFETIME_RANGE
      later(() => {
        setPlaced((prev) => prev.map((p) => (p.key === item.key ? { ...p, visible: false } : p)))
        later(() => {
          setPlaced((prev) => prev.filter((p) => p.key !== item.key))
          // 消えたぶんは少し間を置いて別の場所に補充（枚数が減りすぎないように）
          later(spawn, 400 + Math.random() * 1400)
        }, FADE_MS + 80)
      }, lifetime)
    }

    // 最初は少しずつばらまく
    for (let i = 0; i < INITIAL_COUNT; i++) {
      later(spawn, 150 + i * 380)
    }

    let stopped = false
    const loop = () => {
      if (stopped) return
      later(() => {
        spawn()
        loop()
      }, SPAWN_MIN + Math.random() * SPAWN_RANGE)
    }
    loop()

    const timers = timersRef.current
    return () => {
      stopped = true
      timers.forEach((id) => window.clearTimeout(id))
      timers.clear()
      setPlaced([])
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
        {placed.map((p) => {
          const photo = photos[p.photoIndex % photos.length]
          return (
            <div
              key={p.key}
              className={`${styles.slot} ${styles[p.sizeClass]} ${
                p.visible ? '' : styles.slotHidden
              }`}
              style={
                {
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  zIndex: p.z,
                  '--rot': `${p.rot}deg`,
                  '--bob-delay': `-${(p.key % 7) * 0.9}s`,
                } as React.CSSProperties
              }
            >
              <div className={styles.slotCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
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
