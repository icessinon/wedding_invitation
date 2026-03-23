'use client'

import React, { useRef, useState, useEffect } from 'react'
import styles from './profile.module.css'
import type { ProfileProps } from './types'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { ProfileTitle } from './ProfileTitle'

export const Profile: React.FC<ProfileProps> = (props) => {
  const titleText = 'PROFILE'
  const titleWrapperRef = useRef<HTMLDivElement>(null)
  const visibleChars = useTitleAnimation(titleWrapperRef, titleText)
  const [sparkleStyles, setSparkleStyles] = useState<Array<React.CSSProperties>>([])
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      const styles = [...Array(20)].map(() => ({
        '--x': `${Math.random() * 100}%`,
        '--y': `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
      } as React.CSSProperties))
      setSparkleStyles(styles)
    }
  }, [])

  return (
    <div className={styles.container}>
      {sparkleStyles.map((style, i) => (
        <div
          key={i}
          className={styles.sparkle}
          style={style}
        />
      ))}
      <div className={styles.waveTop}></div>
      <div ref={titleWrapperRef}>
        <ProfileTitle titleText={titleText} visibleChars={visibleChars} />
      </div>

      <div className={styles.groomSection}>
        <div className={styles.groomImageWrapper}>
          <div className={styles.imagePlaceholder}>
            <span className={styles.imageLabel}>写真</span>
          </div>
        </div>
        <div className={styles.groomInfo}>
          <h3 className={`${styles.sectionTitle} ${styles.groomTitle}`}>Groom</h3>
          <div className={styles.groomImageWrapperMobile}>
            <div className={styles.imagePlaceholder}>
              <span className={styles.imageLabel}>写真</span>
            </div>
          </div>
          <div className={styles.nameField}>
            <span className={styles.nameText}>新田　剛志</span>
          </div>
          <div className={styles.greetingField}>
            <span className={styles.greetingLabel}>皆様にお会いできることが今から楽しみです！美味しい料理と飲み物をご用意してお待ちしています</span>
          </div>
        </div>
      </div>

      <div className={styles.brideSection}>
        <div className={styles.brideInfo}>
          <h3 className={`${styles.sectionTitle} ${styles.brideTitle}`}>Bride</h3>
          <div className={styles.brideImageWrapperMobile}>
            <div className={styles.imagePlaceholder}>
              <span className={styles.imageLabel}>写真</span>
            </div>
          </div>
          <div className={styles.nameField}>
            <span className={styles.nameText}>井田　菜摘</span>
          </div>
          <div className={styles.greetingField}>
            <span className={styles.greetingLabel}>いつも支えてくれて本当にありがとうございます！これからも 夫婦共々よろしくお願いいたします</span>
          </div>
        </div>
        <div className={styles.brideImageWrapper}>
          <div className={styles.imagePlaceholder}>
            <span className={styles.imageLabel}>写真</span>
          </div>
        </div>
      </div>

      <div className={styles.waveBottom}></div>
    </div>
  )
}

