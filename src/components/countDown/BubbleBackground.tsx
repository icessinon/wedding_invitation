import React, { useState, useEffect, useCallback, useRef } from 'react'
import styles from './countDown.module.css'

interface Bubble {
  id: number
  scale: number
  left: number
  top: number
  color?: string
}

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
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const initializedRef = useRef<boolean>(false)
  const lastBubbleTimeRef = useRef<number>(0)
  const touchHandledRef = useRef<boolean>(false)
  const isProcessingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      const initialBubbles = Array.from({ length: 5 }, (_, index) => {
        const hasColor = index % 5 === 0
        return {
          id: index,
          scale: Math.random() * 0.6 + 0.2,
          left: Math.random() * 100,
          top: Math.random() * 100,
          color: hasColor ? getRandomColor() : undefined,
        }
      })
      setBubbles(initialBubbles)
    }
  }, [])

  const handleAddBubble = useCallback((clientX: number, clientY: number) => {
    const now = Date.now()
    
    if (now - lastBubbleTimeRef.current < 200) {
      return
    }

    if (isProcessingRef.current) {
      return
    }

    isProcessingRef.current = true
    lastBubbleTimeRef.current = now

    const container = document.querySelector(`.${styles.bubbleContainer}`) as HTMLElement
    if (!container) {
      isProcessingRef.current = false
      return
    }

    const rect = container.getBoundingClientRect()
    const left = ((clientX - rect.left) / rect.width) * 100
    const top = ((clientY - rect.top) / rect.height) * 100

    setBubbles((prev) => {
      // 5個に1個だけランダムな色を適用
      const bubbleCount = prev.length
      const hasColor = bubbleCount % 5 === 0

      const newBubble: Bubble = {
        id: now,
        scale: Math.random() * 0.6 + 0.2,
        left: Math.max(5, Math.min(95, left)),
        top: Math.max(5, Math.min(95, top)),
        color: hasColor ? getRandomColor() : undefined,
      }

      setTimeout(() => {
        isProcessingRef.current = false
      }, 200)
      return [...prev, newBubble]
    })
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    touchHandledRef.current = true
    
    const touch = e.touches[0]
    if (touch) {
      handleAddBubble(touch.clientX, touch.clientY)
    }
    
    setTimeout(() => {
      touchHandledRef.current = false
    }, 500)
  }, [handleAddBubble])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (touchHandledRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
    handleAddBubble(e.clientX, e.clientY)
  }, [handleAddBubble])

  return (
    <div 
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
    </div>
  )
}

