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
  /** 幅・高さ（ステージに対する%）— 重なり判定に使う */
  w: number
  h: number
  z: number
  visible: boolean
}

/** hf = 高さ/幅の概算比（ステージの縦横比込み） */
const SIZE_DEFS = [
  { cls: 'sizeL', w: 38, hf: 0.62 },
  { cls: 'sizeM', w: 30, hf: 0.62 },
  { cls: 'sizeS', w: 24, hf: 0.85 },
] as const

function pickSize() {
  const r = Math.random()
  if (r < 0.3) return SIZE_DEFS[0]
  if (r < 0.7) return SIZE_DEFS[1]
  return SIZE_DEFS[2]
}

/** 矩形同士の重なり面積 */
function overlapArea(
  a: { left: number; top: number; w: number; h: number },
  b: { left: number; top: number; w: number; h: number }
): number {
  const x = Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left)
  const y = Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top)
  return Math.max(0, x) * Math.max(0, y)
}

export const OceanMemories: React.FC = () => {
  const [photos, setPhotos] = useState<DriftPhoto[]>([])
  const [placed, setPlaced] = useState<Placed[]>([])
  const placedRef = useRef<Placed[]>([])
  const keyRef = useRef(0)
  const zRef = useRef(1)
  /** シャッフル済みの「山札」。引き切ったら再シャッフル */
  const deckRef = useRef<number[]>([])
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

    deckRef.current = []

    /** フォルダ順に偏らないよう、シャッフルした山札からランダムに引く */
    const drawPhotoIndex = (): number => {
      if (deckRef.current.length === 0) {
        const deck = photos.map((_, i) => i)
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[deck[i], deck[j]] = [deck[j], deck[i]]
        }
        deckRef.current = deck
      }
      // いま表示中の写真はできるだけ避ける
      const visible = new Set(placedRef.current.map((p) => p.photoIndex))
      const pos = deckRef.current.findIndex((i) => !visible.has(i))
      if (pos >= 0) return deckRef.current.splice(pos, 1)[0]
      return deckRef.current.shift() ?? 0
    }

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
      const h = size.w * size.hf
      const cardArea = size.w * h
      // 候補をたくさん試して「既存の写真との重なり面積」が最小の場所を選ぶ
      const existing = placedRef.current
      let best: { left: number; top: number } | null = null
      let bestOverlap = Infinity
      for (let t = 0; t < 20; t++) {
        const c = {
          left: Math.random() * (96 - size.w),
          top: Math.random() * Math.max(4, 96 - h),
          w: size.w,
          h,
        }
        let total = 0
        for (const p of existing) {
          total += overlapArea(c, p)
          if (total >= bestOverlap) break
        }
        if (total < bestOverlap) {
          bestOverlap = total
          best = c
        }
        if (total === 0) break // 完全に空いている場所が見つかった
      }

      // どこに置いても2割以上かぶってしまう混み具合なら、少し待ってから置き直す
      if (!best || (bestOverlap > cardArea * 0.2 && existing.length >= 5)) {
        later(spawn, 900 + Math.random() * 900)
        return
      }

      const photoIndex = drawPhotoIndex()
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
        h,
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
