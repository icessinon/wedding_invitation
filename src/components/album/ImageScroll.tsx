import React, { forwardRef } from 'react'
import styles from './album.module.css'

interface ImageScrollProps {
  images: string[]
  isDragging: boolean
  scrollContentRef: React.RefObject<HTMLDivElement | null>
  swipeHandlers: {
    handleTouchStart: (e: React.TouchEvent) => void
    handleTouchMove: (e: React.TouchEvent) => void
    handleTouchEnd: (e: React.TouchEvent) => void
    handleTouchCancel: (e: React.TouchEvent) => void
    handleMouseDown: (e: React.MouseEvent) => void
    handleMouseMove: (e: React.MouseEvent) => void
    handleMouseUp: () => void
    handleMouseLeave: () => void
  }
}

export const ImageScroll = forwardRef<HTMLDivElement, ImageScrollProps>(({
  images,
  isDragging,
  scrollContentRef,
  swipeHandlers,
}, ref) => {
  return (
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
        {images.map((image, index) => (
          <div key={index} className={styles.imageWrapper}>
            <img 
              src={image} 
              alt={`Wedding photo ${index + 1}`}
              className={styles.image}
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
})
