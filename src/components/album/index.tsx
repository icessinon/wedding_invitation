'use client'
import React, { useRef } from 'react'
import styles from './album.module.css'
import type { AlbumProps } from './types'
import { useScrollAnimation } from './hooks/useScrollAnimation'
import { useSwipeHandlers } from './hooks/useSwipeHandlers'
import { useTitleAnimation } from './hooks/useTitleAnimation'
import { AlbumTitle } from './AlbumTitle'
import { ImageScroll } from './ImageScroll'
import { CoralDecoration } from './CoralDecoration'

export const Album: React.FC<AlbumProps> = ({ images = [] }) => {
  const defaultImages = images.length > 0 
    ? images 
    : [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=600&fit=crop',
      ]

  const duplicatedImages = [...defaultImages, ...defaultImages]
  const titleText = 'ALBUM'
  
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageScrollWrapperRef = useRef<HTMLDivElement>(null)

  const animationOffsetRef = useRef(0)
  const swipeHandlers = useSwipeHandlers(scrollContentRef, animationOffsetRef)
  useScrollAnimation(scrollContentRef, swipeHandlers.isDraggingRef, animationOffsetRef)
  const visibleChars = useTitleAnimation(imageScrollWrapperRef, titleText)

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.waveTop}></div>
      <AlbumTitle titleText={titleText} visibleChars={visibleChars} />
      <ImageScroll
        ref={imageScrollWrapperRef}
        images={duplicatedImages}
        isDragging={swipeHandlers.isDragging}
        scrollContentRef={scrollContentRef}
        swipeHandlers={swipeHandlers}
      />
      <div className={styles.waveBottom}></div>
      <CoralDecoration />
    </div>
  )
}
