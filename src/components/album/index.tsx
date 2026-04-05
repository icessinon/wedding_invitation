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
        '/images/album/kage.jpg',
        '/images/album/hurt.jpg',
        '/images/album/hand.jpg',
        '/images/album/five.jpg',
        '/images/album/riku.jpg',
        '/images/album/sora.jpg',
        '/images/album/hana.jpg',
        '/images/album/naki.jpg',
        '/images/album/sleep.jpg',
        '/images/album/sanpo.jpg',
        '/images/album/sakura.jpg',
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
