'use client'
import React, { useRef } from 'react'
import styles from './other.module.css'
import type { OtherProps } from './types'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { OtherTitle } from './OtherTitle'

export const Other: React.FC<OtherProps> = ({
  arrivalTime = '○時○分',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleText = 'INFORMATION'
  const visibleChars = useTitleAnimation(containerRef, titleText)

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.titleSection}>
          <OtherTitle titleText={titleText} visibleChars={visibleChars} />
        </div>
        
        <div className={styles.divider}></div>
        
        <div className={styles.sectionTitle}>その他のご案内</div>
        
        <div className={styles.divider}></div>
        
        <div className={styles.requestBox}>
          <div className={styles.boxHeader}>挙式参列のお願い</div>
          <div className={styles.boxDivider}></div>
          <div className={styles.boxContent}>
            <p>誠に恐れ入りますが</p>
            <p>挙式にもご列席賜りたく</p>
            <p>当日は{arrivalTime}迄に</p>
            <p>ご光来のほど</p>
            <p>よろしくお願い申し上げます</p>
          </div>
        </div>
      </div>
    </div>
  )
}

