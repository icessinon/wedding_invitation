import { useState, useEffect, useRef } from 'react'

export const useTitleAnimation = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  titleText: string,
  delay = 0
) => {
  const [visibleChars, setVisibleChars] = useState(0)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const startAnimation = () => {
      if (hasAnimatedRef.current) return
      hasAnimatedRef.current = true
      titleText.split('').forEach((_, index) => {
        setTimeout(() => {
          setVisibleChars(index + 1)
        }, delay + index * 100)
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
            startAnimation()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef, titleText, delay])

  return visibleChars
}
