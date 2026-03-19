import { useState, useEffect, useRef } from 'react'

export const useTitleAnimation = (containerRef: React.RefObject<HTMLDivElement | null>, titleText: string) => {
  const [visibleChars, setVisibleChars] = useState(0)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const currentRef = containerRef.current
    if (!currentRef) return

    const checkIfOutOfView = () => {
      const rect = currentRef.getBoundingClientRect()
      return rect.bottom < 0 || rect.top > window.innerHeight
    }

    if (checkIfOutOfView()) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.1 && !hasAnimatedRef.current) {
              hasAnimatedRef.current = true
              titleText.split('').forEach((_, index) => {
                setTimeout(() => {
                  setVisibleChars(index + 1)
                }, index * 100)
              })
            }
          })
        },
        { 
          threshold: 0.1,
          rootMargin: '0px'
        }
      )

      observer.observe(currentRef)

      return () => {
        observer.unobserve(currentRef)
      }
    } else {
      const handleScroll = () => {
        if (checkIfOutOfView() && !hasAnimatedRef.current) {
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.1 && !hasAnimatedRef.current) {
                  hasAnimatedRef.current = true
                  titleText.split('').forEach((_, index) => {
                    setTimeout(() => {
                      setVisibleChars(index + 1)
                    }, index * 100)
                  })
                }
              })
            },
            { 
              threshold: 0.1,
              rootMargin: '0px'
            }
          )
          observer.observe(currentRef)
          window.removeEventListener('scroll', handleScroll, true)
        }
      }
      window.addEventListener('scroll', handleScroll, { passive: true, capture: true })

      return () => {
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [containerRef, titleText])

  return visibleChars
}
