'use client'

import React, { useEffect, useState } from 'react'
import styles from './firstView.module.css'
import type { FirstViewProps } from './types'

export const FirstView: React.FC<FirstViewProps> = (props) => {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={styles.container}>
      <div 
        className={styles.backgroundImage}
        style={{
          transform: `translateY(${scrollY * 0.5}px)`,
        }}
      />
      <div className={styles.overlay} />
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.firstViewLabel}>FirstView</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headerMenu}>
            <span className={styles.menuText}>ウエディングショット</span>
            <span className={styles.menuText}>スライドショー</span>
            <button className={styles.hamburgerMenu}>
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <h1 className={styles.title}>
          <span className={styles.titleLine}>Wedding</span>
          <span className={styles.titleLine}>Invitation</span>
        </h1>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.date}>
          YYYY/MM/DD
        </div>
      </div>

      {/* Social Icon */}
      <div className={styles.socialIcon}>
        <a href="#" className={styles.twitterIcon}>t</a>
      </div>
    </div>
  )
}

