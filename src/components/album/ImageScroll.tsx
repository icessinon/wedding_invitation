import React, { forwardRef, useState, useRef, useCallback } from 'react'
import styles from './album.module.css'

interface ImageScrollProps {
  images: string[]
  isDragging: boolean
  scrollContentRef: React.RefObject<HTMLDivElement | null>
  swipeHandlers: {
    handleTouchStart: (e: React.TouchEvent) => void
    handleTouchMove: (e: React.TouchEvent) => void
    handleTouchEnd: () => void
    handleTouchCancel: () => void
    handleMouseDown: (e: React.MouseEvent) => void
    handleMouseMove: (e: React.MouseEvent) => void
    handleMouseUp: () => void
    handleMouseLeave: () => void
  }
}

const FLIP_MAP: Record<string, string> = {
  '/images/album/riku.jpg':   '/images/album/riku2.jpg',
  '/images/album/sora.jpg':   '/images/album/sora2.jpg',
  '/images/album/sleep.jpg':  '/images/album/sleep2.jpg',
  '/images/album/hana.jpg':   '/images/album/hana2.jpg',
  '/images/album/kage.jpg':   '/images/album/kage2.jpg',
  '/images/album/sakura.jpg': '/images/album/sakura2.jpg',
  '/images/album/five.jpg':   '/images/album/five2.jpg',
  '/images/album/hurt.jpg':   '/images/album/hurt2.jpg',
  '/images/album/naki.jpg':   '/images/album/naki2.jpg',
  '/images/album/sanpo.jpg':  '/images/album/sanpo2.jpg',
  '/images/album/ring.jpg':   '/images/album/ring2.jpg',
}

const TOTAL_FLIP = Object.keys(FLIP_MAP).length

export const ImageScroll = forwardRef<HTMLDivElement, ImageScrollProps>(({
  images,
  isDragging,
  scrollContentRef,
  swipeHandlers,
}, ref) => {
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set())
  const [showComplete, setShowComplete] = useState(false)
  const seenBackPaths = useRef<Set<string>>(new Set())

  const handleFlip = useCallback((index: number, imagePath: string) => {
    setFlippedSet(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
        seenBackPaths.current.add(imagePath)
        if (seenBackPaths.current.size >= TOTAL_FLIP) {
          setShowComplete(true)
        }
      }
      return next
    })
  }, [])

  return (
    <>
      <div
        ref={ref}
        className={styles.scrollWrapper}
        onMouseMove={swipeHandlers.handleMouseMove}
        onMouseUp={swipeHandlers.handleMouseUp}
        onMouseLeave={swipeHandlers.handleMouseLeave}
        onTouchStart={swipeHandlers.handleTouchStart}
        onTouchMove={swipeHandlers.handleTouchMove}
        onTouchEnd={swipeHandlers.handleTouchEnd}
        onTouchCancel={swipeHandlers.handleTouchCancel}
        onMouseDown={swipeHandlers.handleMouseDown}
      >
        <div
          ref={scrollContentRef}
          className={`${styles.scrollContent} ${isDragging ? styles.dragging : ''}`}
        >
          {images.map((image, index) => {
            const backImage = FLIP_MAP[image]
            const isFlipped = flippedSet.has(index)

            if (backImage) {
              return (
                <div
                  key={index}
                  className={`${styles.imageWrapper} ${styles.imageWrapperFlippable}`}
                  onClick={() => handleFlip(index, image)}
                >
                  <div className={styles.flipCard}>
                    <div className={`${styles.flipCardInner} ${isFlipped ? styles.flipped : ''}`}>
                      <div className={styles.flipCardFront}>
                        <img src={image} alt={`Wedding photo ${index + 1}`} className={styles.image} draggable={false} />
                      </div>
                      <div className={styles.flipCardBack}>
                        <img src={backImage} alt={`Wedding photo ${index + 1} back`} className={styles.image} draggable={false} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={index} className={styles.imageWrapper}>
                <img src={image} alt={`Wedding photo ${index + 1}`} className={styles.image} draggable={false} />
              </div>
            )
          })}
        </div>
      </div>

      {showComplete && (
        <div className={styles.completeOverlay} onClick={() => setShowComplete(false)}>
          <div className={styles.completeCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.completeHearts}>
              <span>♡</span><span>♡</span><span>♡</span>
            </div>
            <p className={styles.completeText}>恥ずかしい笑</p>
            <p className={styles.completeSubText}>全部見てくれてありがとう</p>
            <button className={styles.completeClose} onClick={() => setShowComplete(false)}>閉じる</button>
          </div>
        </div>
      )}
    </>
  )
})

ImageScroll.displayName = 'ImageScroll'
