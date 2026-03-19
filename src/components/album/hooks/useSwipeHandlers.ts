import { useState, useRef } from 'react'

export const useSwipeHandlers = (
  scrollContentRef: React.RefObject<HTMLDivElement | null>,
  animationOffsetRef: React.MutableRefObject<number>
) => {
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const currentOffsetRef = useRef(0)
  const lastTimeRef = useRef<number>(0)

  const handleStart = (clientX: number) => {
    isDraggingRef.current = true
    setIsDragging(true)
    startXRef.current = clientX
    currentOffsetRef.current = animationOffsetRef.current
    lastTimeRef.current = 0
  }

  const handleMove = (clientX: number) => {
    if (!isDraggingRef.current || !scrollContentRef.current) return
    
    const deltaX = startXRef.current - clientX
    const sensitivity = 0.4
    const adjustedDeltaX = deltaX * sensitivity
    const newOffset = currentOffsetRef.current + adjustedDeltaX
    
    const maxOffset = scrollContentRef.current.scrollWidth / 2
    let finalOffset = newOffset
    if (finalOffset < 0) {
      finalOffset = maxOffset + finalOffset
    } else if (finalOffset >= maxOffset) {
      finalOffset = finalOffset - maxOffset
    }
    
    animationOffsetRef.current = finalOffset
    currentOffsetRef.current = finalOffset
    scrollContentRef.current.style.transform = `translateX(-${finalOffset}px)`
    
    startXRef.current = clientX
  }

  const handleEnd = () => {
    isDraggingRef.current = false
    setIsDragging(false)
    lastTimeRef.current = performance.now()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      e.preventDefault()
      handleStart(touch.clientX)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return
    const touch = e.touches[0]
    if (touch) {
      e.preventDefault()
      e.stopPropagation()
      handleMove(touch.clientX)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleEnd()
  }

  const handleTouchCancel = (e: React.TouchEvent) => {
    e.preventDefault()
    handleEnd()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault()
      handleMove(e.clientX)
    }
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      handleEnd()
    }
  }

  return {
    isDragging,
    isDraggingRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  }
}

export type SwipeHandlers = ReturnType<typeof useSwipeHandlers>
