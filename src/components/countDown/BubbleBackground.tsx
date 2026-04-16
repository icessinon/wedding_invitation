import React, { useState, useEffect, useCallback, useRef } from 'react'
import styles from './countDown.module.css'

interface Bubble {
  id: number
  scale: number
  left: number
  top: number
  color?: string
}

const MAX_BUBBLES = 20

// 青・白・黄緑・黄色を各魚でランダムに組み合わせたパレット
const COLOR_PALETTES = [
  // 青メイン
  ['rgba(40,160,255,0.92)', 'rgba(120,210,255,0.90)', 'rgba(200,240,255,0.88)', 'rgba(60,180,255,0.90)', 'rgba(30,130,220,0.92)'],
  // 黄緑メイン
  ['rgba(100,210,70,0.92)', 'rgba(160,240,100,0.90)', 'rgba(220,255,160,0.88)', 'rgba(120,220,80,0.90)', 'rgba(80,190,50,0.92)'],
  // 黄色メイン
  ['rgba(255,230,40,0.92)', 'rgba(255,250,120,0.90)', 'rgba(240,220,30,0.88)', 'rgba(255,240,80,0.90)', 'rgba(220,195,20,0.92)'],
  // 白メイン
  ['rgba(240,250,255,0.94)', 'rgba(180,230,255,0.90)', 'rgba(255,255,255,0.92)', 'rgba(200,240,255,0.90)', 'rgba(240,250,255,0.94)'],
  // 青→黄緑
  ['rgba(40,160,255,0.90)', 'rgba(255,255,255,0.88)', 'rgba(120,220,80,0.90)', 'rgba(180,240,100,0.92)', 'rgba(100,210,70,0.90)'],
  // 黄緑→黄色
  ['rgba(120,220,80,0.92)', 'rgba(200,250,120,0.90)', 'rgba(255,235,60,0.90)', 'rgba(240,220,40,0.92)', 'rgba(120,220,80,0.88)'],
  // 白→青
  ['rgba(255,255,255,0.92)', 'rgba(40,160,255,0.88)', 'rgba(180,230,255,0.90)', 'rgba(40,160,255,0.86)', 'rgba(255,255,255,0.92)'],
  // 黄色→白→青
  ['rgba(255,230,40,0.92)', 'rgba(255,255,200,0.90)', 'rgba(255,255,255,0.88)', 'rgba(120,210,255,0.90)', 'rgba(40,160,255,0.92)'],
]

const FISH_SCHOOL = [
  { top: 22, delay: 0.00, scale: 0.72, palette: 0 },
  { top: 35, delay: 0.18, scale: 0.60, palette: 5 },
  { top: 48, delay: 0.35, scale: 0.68, palette: 2 },
  { top: 28, delay: 0.52, scale: 0.55, palette: 7 },
  { top: 58, delay: 0.68, scale: 0.64, palette: 1 },
  { top: 40, delay: 0.85, scale: 0.58, palette: 3 },
  { top: 18, delay: 1.05, scale: 0.50, palette: 6 },
  { top: 65, delay: 1.22, scale: 0.62, palette: 4 },
  { top: 32, delay: 1.40, scale: 0.56, palette: 2 },
  { top: 52, delay: 1.58, scale: 0.66, palette: 0 },
]

const INITIAL_BUBBLES: Bubble[] = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  scale: 0.3 + (i * 0.15),
  left: 15 + i * 17,
  top: 20 + (i % 3) * 25,
  color: i === 0 ? 'rgba(255, 182, 193, 0.4)' : undefined,
}))

const getRandomColor = () => {
  const colors = [
    'rgba(255, 182, 193, 0.4)',
    'rgba(173, 216, 230, 0.4)',
    'rgba(255, 218, 185, 0.4)',
    'rgba(221, 160, 221, 0.4)',
    'rgba(144, 238, 144, 0.4)',
    'rgba(255, 228, 196, 0.4)',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export const BubbleBackground: React.FC = () => {
  const [bubbles, setBubbles] = useState<Bubble[]>(INITIAL_BUBBLES)
  const [fishActive, setFishActive] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fishActiveRef = useRef(false)
  const lastBubbleTimeRef = useRef<number>(0)
  const touchHandledRef = useRef<boolean>(false)

  useEffect(() => {
    if (bubbles.length >= MAX_BUBBLES && !fishActiveRef.current) {
      fishActiveRef.current = true
      setFishActive(true)
    }
  }, [bubbles.length])

  useEffect(() => {
    if (!fishActive) return
    const timer = setTimeout(() => {
      fishActiveRef.current = false
      setFishActive(false)
      setBubbles(INITIAL_BUBBLES.map(b => ({ ...b, id: Date.now() + b.id })))
    }, 7500)
    return () => clearTimeout(timer)
  }, [fishActive])

  const handleAddBubble = useCallback((clientX: number, clientY: number) => {
    if (fishActiveRef.current) return

    const now = Date.now()
    if (now - lastBubbleTimeRef.current < 200) return
    lastBubbleTimeRef.current = now

    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100))
    const top = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100))

    setBubbles((prev) => {
      const hasColor = prev.length % 5 === 0
      const newBubble: Bubble = {
        id: now,
        scale: Math.random() * 0.6 + 0.2,
        left,
        top,
        color: hasColor ? getRandomColor() : undefined,
      }
      return prev.length >= MAX_BUBBLES ? [...prev.slice(1), newBubble] : [...prev, newBubble]
    })
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    touchHandledRef.current = true
    const touch = e.touches[0]
    if (touch) handleAddBubble(touch.clientX, touch.clientY)
    setTimeout(() => { touchHandledRef.current = false }, 500)
  }, [handleAddBubble])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (touchHandledRef.current) { e.preventDefault(); e.stopPropagation(); return }
    e.preventDefault()
    e.stopPropagation()
    handleAddBubble(e.clientX, e.clientY)
  }, [handleAddBubble])

  return (
    <div
      ref={containerRef}
      className={styles.bubbleContainer}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    >
      {bubbles.map((bubble, index) => (
        <div
          key={bubble.id}
          className={styles.bubble}
          style={{
            '--bubble-scale': bubble.scale,
            '--bubble-index': index,
            '--bubble-color': bubble.color || 'rgba(255, 255, 255, 0.25)',
            left: `${bubble.left}%`,
            top: `${bubble.top}%`,
          } as React.CSSProperties}
        >
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      ))}

      {fishActive && (
        <div className={styles.fishSchool}>
          {FISH_SCHOOL.map((fish, i) => {
            const p = COLOR_PALETTES[fish.palette]
            return (
              <div
                key={i}
                className={styles.fishItem}
                style={{ top: `${fish.top}%`, '--fish-delay': `${fish.delay}s` } as React.CSSProperties}
              >
                <svg
                  width={Math.round(80 * fish.scale)}
                  height={Math.round(36 * fish.scale)}
                  viewBox="0 0 80 36"
                  xmlns="http://www.w3.org/2000/svg"
                  className={styles.fishSvg}
                >
                  <defs>
                    <linearGradient id={`fg${i}`} x1="0%" y1="50%" x2="100%" y2="50%">
                      <stop offset="0%"   stopColor={p[0]} />
                      <stop offset="25%"  stopColor={p[1]} />
                      <stop offset="50%"  stopColor={p[2]} />
                      <stop offset="75%"  stopColor={p[3]} />
                      <stop offset="100%" stopColor={p[4]} />
                    </linearGradient>
                    <linearGradient id={`ft${i}`} x1="100%" y1="50%" x2="0%" y2="50%">
                      <stop offset="0%"   stopColor={p[0]} />
                      <stop offset="100%" stopColor={p[0].replace(/[\d.]+\)$/, '0.05)')} />
                    </linearGradient>
                    <radialGradient id={`fs${i}`} cx="65%" cy="28%" r="38%">
                      <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
                    </radialGradient>
                  </defs>
                  {/* 尾ひれ */}
                  <path d="M12,18 L1,4 Q8,15 9,18 Q8,21 1,32 Z"
                    fill={`url(#ft${i})`} stroke={p[0]} strokeWidth="0.4" />
                  {/* 胴体 */}
                  <path d="M11,18 C20,5 50,4 68,13 Q74,18 68,23 C50,32 20,31 11,18 Z"
                    fill={`url(#fg${i})`} stroke={p[1]} strokeWidth="0.4" />
                  {/* 光沢 */}
                  <path d="M11,18 C20,5 50,4 68,13 Q74,18 68,23 C50,32 20,31 11,18 Z"
                    fill={`url(#fs${i})`} />
                  {/* 背びれ */}
                  <path d="M24,5 Q36,0 48,4 Q40,6 24,5"
                    fill={p[2]} stroke={p[1]} strokeWidth="0.3" />
                  {/* 鱗ライン */}
                  <path d="M22,12 Q27,8 32,12" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="0.7" />
                  <path d="M32,10 Q37,6 42,10" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7" />
                  <path d="M42,10 Q47,6 52,10" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="0.7" />
                </svg>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
