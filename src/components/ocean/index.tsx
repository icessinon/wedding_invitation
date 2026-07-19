import React from 'react'
import styles from './ocean.module.css'

/** 2周期分の波形（-50% ループでシームレスにつながる） */
const WAVE_PATH =
  'M0,64 C240,96 480,32 720,64 C960,96 1200,32 1440,64 C1680,96 1920,32 2160,64 C2400,96 2640,32 2880,64 L2880,120 L0,120 Z'

interface WaveDividerProps {
  /** 波の色（＝次のセクションの背景色） */
  color: string
  height?: number
  className?: string
}

/** セクションのつなぎ目に置く、流れる波 */
export const WaveDivider: React.FC<WaveDividerProps> = ({ color, height = 84, className }) => (
  <div
    className={`${styles.waveDivider} ${className ?? ''}`}
    style={{ height, color }}
    aria-hidden="true"
  >
    <svg className={styles.waveLayerSlow} viewBox="0 0 2880 120" preserveAspectRatio="none">
      <path d={WAVE_PATH} fill="currentColor" />
    </svg>
    <svg className={styles.waveLayerMid} viewBox="0 0 2880 120" preserveAspectRatio="none">
      <path d={WAVE_PATH} fill="currentColor" transform="translate(480 0)" />
    </svg>
    <svg className={styles.waveLayerFast} viewBox="0 0 2880 120" preserveAspectRatio="none">
      <path d={WAVE_PATH} fill="currentColor" />
    </svg>
  </div>
)

interface RisingBubblesProps {
  count?: number
  className?: string
}

/** セクション背景に敷く、立ちのぼる泡（インデックスから決定的に配置） */
export const RisingBubbles: React.FC<RisingBubblesProps> = ({ count = 36, className }) => (
  <div className={`${styles.bubbles} ${className ?? ''}`} aria-hidden="true">
    {Array.from({ length: count }, (_, i) => {
      const left = ((i * 43 + 17) % 89) + 5
      const size = 2 + (i % 5) + (i % 7 === 0 ? 2 : 0)
      const duration = 16 + ((i * 53 + (i % 13) * 37) % 34)
      const delay = -((i * 1.7) % 24)
      return (
        <span
          key={i}
          className={styles.bubble}
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      )
    })}
  </div>
)

const FISH = [
  { top: '18%', scale: 1, opacity: 0.15, dur: 46, delay: 0, reverse: false },
  { top: '34%', scale: 0.7, opacity: 0.12, dur: 58, delay: -18, reverse: true },
  { top: '58%', scale: 1.25, opacity: 0.1, dur: 70, delay: -35, reverse: false },
  { top: '76%', scale: 0.85, opacity: 0.14, dur: 52, delay: -8, reverse: true },
  { top: '46%', scale: 0.55, opacity: 0.12, dur: 40, delay: -27, reverse: false },
]

/** ゆっくり横切る魚のシルエット */
export const FishSchool: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${styles.fishLayer} ${className ?? ''}`} aria-hidden="true">
    {FISH.map((f, i) => (
      <div
        key={i}
        className={`${styles.fish} ${f.reverse ? styles.fishReverse : ''}`}
        style={
          {
            '--fish-top': f.top,
            '--fish-scale': f.scale,
            '--fish-opacity': f.opacity,
            '--fish-dur': `${f.dur}s`,
            '--fish-delay': `${f.delay}s`,
          } as React.CSSProperties
        }
      >
        <svg className={styles.fishBody} viewBox="0 0 34 24" fill="currentColor">
          <path d="M2 12 Q13 3 24 12 Q13 21 2 12 Z" />
          <path d="M23 12 L32 6.5 L30 12 L32 17.5 Z" />
          <circle cx="8" cy="10.5" r="1.1" fill="rgba(10,30,50,0.55)" />
        </svg>
      </div>
    ))}
  </div>
)

/**
 * 水平線の上をゆっくり進むヨット。
 * 会場「指帆亭」（海に浮かぶ帆船をイメージした洋館）へのオマージュ
 */
export const SailingHorizon: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${styles.horizon} ${className ?? ''}`} aria-hidden="true">
    <span className={styles.horizonLine} />
    <div className={styles.sailBoat}>
      <svg className={styles.sailBoatBody} viewBox="0 0 38 34" fill="currentColor">
        {/* メインセイル */}
        <path d="M17 2 L17 22 L5 22 Q10 12 17 2 Z" />
        {/* ジブセイル */}
        <path d="M20 6 L20 22 L32 22 Q27 13 20 6 Z" />
        {/* 船体 */}
        <path d="M2 25 L36 25 L30 31 L8 31 Z" />
      </svg>
    </div>
  </div>
)

const RAYS = [
  { left: '8%', angle: 14, dur: 8, delay: 0 },
  { left: '30%', angle: 10, dur: 11, delay: -4 },
  { left: '55%', angle: 16, dur: 9, delay: -2 },
  { left: '78%', angle: 8, dur: 12, delay: -7 },
]

/** 水面から差し込む光のカーテン */
export const LightRays: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${styles.lightRays} ${className ?? ''}`} aria-hidden="true">
    {RAYS.map((r, i) => (
      <span
        key={i}
        className={styles.ray}
        style={
          {
            left: r.left,
            '--ray-angle': `${r.angle}deg`,
            '--ray-dur': `${r.dur}s`,
            '--ray-delay': `${r.delay}s`,
          } as React.CSSProperties
        }
      />
    ))}
  </div>
)
