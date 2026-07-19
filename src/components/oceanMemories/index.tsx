'use client'

import React, { useEffect, useMemo, useState } from 'react'
import styles from './oceanMemories.module.css'
import { LightRays, FishSchool, RisingBubbles, SailingHorizon } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'
import type { PhotosApiResponse } from '../photoShare/types'

/** 流れに使うゲスト写真の最大数 */
const MAX_PHOTOS_IN_DRIFT = 45
/** 常に3行で「たくさん流れている」見た目にする */
const ROW_COUNT = 3
/** 行がスカスカにならないよう、1行あたり最低この枚数になるまで繰り返して埋める */
const MIN_PER_ROW = 8

interface DriftPhoto {
  url: string
  uploader: string
}

const SIZE_CLASSES = ['sizeM', 'sizeL', 'sizeS', 'sizeM', 'sizeS', 'sizeL'] as const

export const OceanMemories: React.FC = () => {
  const [photos, setPhotos] = useState<DriftPhoto[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/photos')
      .then((res) => res.json())
      .then((json: PhotosApiResponse) => {
        if (cancelled || !json.ok || !json.photos) return
        setPhotos(
          json.photos
            .slice(0, MAX_PHOTOS_IN_DRIFT)
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

  const rows = useMemo(() => {
    if (photos.length === 0) return []
    const needed = MIN_PER_ROW * ROW_COUNT
    const filled: DriftPhoto[] = []
    for (let i = 0; filled.length < Math.max(needed, photos.length); i++) {
      filled.push(photos[i % photos.length])
    }
    const result: DriftPhoto[][] = Array.from({ length: ROW_COUNT }, () => [])
    filled.forEach((p, i) => result[i % ROW_COUNT].push(p))
    return result
  }, [photos])

  // 当日の写真がまだないときは何も出さない
  if (rows.length === 0) return null

  return (
    <section className={styles.container}>
      <LightRays />
      <RisingBubbles count={40} />

      <SectionTitle en="Drifting Memories" ja="皆様と過ごした 大切な一日" />

      <SailingHorizon />

      <div className={styles.rows}>
        {rows.map((row, rowIndex) => {
          const duration = 60 + rowIndex * 22
          const reverse = rowIndex % 2 === 1
          return (
            <div key={rowIndex} className={styles.row}>
              <div
                className={`${styles.rowTrack} ${reverse ? styles.rowTrackReverse : ''}`}
                style={{
                  animationDuration: `${duration}s`,
                  // 最初から「流れている途中」に見えるよう行ごとに位相をずらす
                  animationDelay: `-${(duration * (rowIndex + 1)) / 3.7}s`,
                }}
              >
                {[...row, ...row].map((photo, i) => {
                  const tilt = ((i * 37 + rowIndex * 61) % 9) - 4
                  const bobDur = 4.5 + ((i * 13 + rowIndex * 7) % 30) / 10
                  const bobDelay = -(((i * 17 + rowIndex * 5) % 40) / 10)
                  const sizeClass = SIZE_CLASSES[(i + rowIndex) % SIZE_CLASSES.length]
                  // カードごとに上下へ散らして、ばらまいたような流れに
                  const shift = ((i * 29 + rowIndex * 13) % 25) - 12
                  return (
                    <div
                      key={i}
                      className={`${styles.card} ${styles[sizeClass]}`}
                      style={
                        {
                          '--tilt': `${tilt}deg`,
                          '--bob-dur': `${bobDur}s`,
                          '--bob-delay': `${bobDelay}s`,
                          marginTop: `${shift}px`,
                        } as React.CSSProperties
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className={styles.cardImage}
                      />
                      {photo.uploader && (
                        <span className={styles.cardCaption}>{photo.uploader}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <FishSchool />
    </section>
  )
}
