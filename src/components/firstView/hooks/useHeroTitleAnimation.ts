import { useState, useEffect, useRef } from 'react'

/**
 * ファーストビュー用。画面内に入ったら文字アニメを開始（ページ先頭でも初回から動く）
 */
export const useHeroTitleAnimation = (
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

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
            startAnimation()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px' }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [containerRef, titleText, delay])

  return visibleChars
}
