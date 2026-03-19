import { useEffect, useRef } from 'react'

export const useScrollAnimation = (
  scrollContentRef: React.RefObject<HTMLDivElement | null>,
  isDraggingRef: React.MutableRefObject<boolean>,
  animationOffsetRef: React.MutableRefObject<number>
) => {
  const animationRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const animate = (currentTime: number) => {
      if (isDraggingRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      if (scrollContentRef.current) {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = currentTime
        }
        
        const deltaTime = currentTime - lastTimeRef.current
        const scrollSpeed = 0.03
        const newOffset = animationOffsetRef.current + scrollSpeed * deltaTime
        
        const maxOffset = scrollContentRef.current.scrollWidth / 2
        const finalOffset = newOffset >= maxOffset ? newOffset - maxOffset : newOffset
        
        animationOffsetRef.current = finalOffset
        if (scrollContentRef.current) {
          scrollContentRef.current.style.transform = `translateX(-${finalOffset}px)`
        }
        lastTimeRef.current = currentTime
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])
}
