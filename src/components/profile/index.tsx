'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import styles from './profile.module.css'
import type { ProfileProps } from './types'
import { useTitleAnimation } from '../../hooks/useTitleAnimation'
import { ProfileTitle } from './ProfileTitle'

type BioData = {
  birthday: string
  blood: string
  job: string
  hobby: string
  cookingSpecialty: string
  favoriteFood: string
}

const GROOM_GREETING = '皆様にお会いできることが今から楽しみです！\n美味しい料理と飲み物をご用意してお待ちしています'
const GROOM_BIO: BioData = {
  birthday: '1996年5月31日',
  blood: 'A型',
  job: 'エンジニア・マーケター',
  hobby: 'ゲーム・運動・料理',
  cookingSpecialty: 'ハンバーグ',
  favoriteFood: '氷菓',
}

const BRIDE_GREETING = 'いつも支えてくれて本当にありがとうございます！\nこれからも夫婦共々よろしくお願いいたします'
const BRIDE_BIO: BioData = {
  birthday: '1996年4月13日',
  blood: 'A型',
  job: '鍼灸・あん摩マッサージ指圧師 ',
  hobby: '掃除',
  cookingSpecialty: 'ミートスパゲティ',
  favoriteFood: 'ハンバーグ',
}

const BIO_FIELDS: { key: keyof BioData; label: string; iconType: string }[] = [
  { key: 'birthday',         label: '生年月日',     iconType: 'birthday' },
  { key: 'blood',            label: '血液型',       iconType: 'blood' },
  { key: 'job',              label: '仕事',         iconType: 'job' },
  { key: 'hobby',            label: '趣味',         iconType: 'hobby' },
  { key: 'cookingSpecialty', label: '得意料理',     iconType: 'cooking' },
  { key: 'favoriteFood',     label: '好きな食べ物', iconType: 'food' },
]

const ICON_COLOR = '#c06080'
const ICON_PROPS = {
  width: 16, height: 16, viewBox: '0 0 24 24',
  fill: 'none', stroke: ICON_COLOR,
  strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

function BioIcon({ type }: { type: string }) {
  switch (type) {
    case 'birthday':
      return (
        <svg {...ICON_PROPS}>
          <rect x="3" y="4" width="18" height="17" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
        </svg>
      )
    case 'blood':
      return (
        <svg {...ICON_PROPS}>
          <path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2z"/>
        </svg>
      )
    case 'job':
      return (
        <svg {...ICON_PROPS}>
          <rect x="2" y="8" width="20" height="13" rx="2"/>
          <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
          <line x1="2" y1="14" x2="22" y2="14"/>
        </svg>
      )
    case 'hobby':
      return (
        <svg {...ICON_PROPS}>
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      )
    case 'cooking':
      return (
        <svg {...ICON_PROPS}>
          <path d="M3 2v7c0 3.87 3.13 7 7 7v6"/>
          <line x1="10" y1="22" x2="10" y2="16"/>
          <path d="M3 2h14"/>
          <line x1="17" y1="2" x2="17" y2="22"/>
          <path d="M17 6c2.5 0 4 1.5 4 4"/>
        </svg>
      )
    case 'food':
      return (
        <svg {...ICON_PROPS}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      )
    default: return null
  }
}

function BioCard({ data, animate }: { data: BioData; animate: boolean }) {
  return (
    <div className={`${styles.bioCard} ${animate ? styles.bioCardAnimate : ''}`}>
      {BIO_FIELDS.map(({ key, label, iconType }) => (
        <div key={key} className={styles.bioRow}>
          <span className={styles.bioIcon}><BioIcon type={iconType} /></span>
          <span className={styles.bioLabel}>{label}</span>
          <span className={styles.bioValue}>{data[key]}</span>
        </div>
      ))}
    </div>
  )
}

export const Profile: React.FC<ProfileProps> = () => {
  const titleText = 'PROFILE'
  const titleWrapperRef = useRef<HTMLDivElement>(null)
  const visibleChars = useTitleAnimation(titleWrapperRef, titleText)
  const [sparkleStyles, setSparkleStyles] = useState<Array<React.CSSProperties>>([])
  const initializedRef = useRef(false)
  const [groomBio, setGroomBio] = useState(false)
  const [brideBio, setBrideBio] = useState(false)
  const [groomRipple, setGroomRipple] = useState(false)
  const [brideRipple, setBrideRipple] = useState(false)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      const s = [...Array(20)].map(() => ({
        '--x': `${Math.random() * 100}%`,
        '--y': `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
      } as React.CSSProperties))
      setSparkleStyles(s)
    }
  }, [])

  const triggerRipple = useCallback((
    setRipple: (v: boolean) => void,
    setBio: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setRipple(true)
    setBio(prev => !prev)
    setTimeout(() => setRipple(false), 1400)
  }, [])

  return (
    <div className={styles.container}>
      {sparkleStyles.map((style, i) => (
        <div key={i} className={styles.sparkle} style={style} />
      ))}
      <div ref={titleWrapperRef}>
        <ProfileTitle titleText={titleText} visibleChars={visibleChars} />
      </div>

      {/* Groom */}
      <div className={styles.groomSection}>
        <div
          className={`${styles.groomImageWrapper} ${styles.rippleWrapper}`}
          onClick={() => triggerRipple(setGroomRipple, setGroomBio)}
        >
          <img src="/images/profile/takeshi.jpg" alt="新郎の画像" className={styles.profileImage} />
          {groomRipple && <span className={styles.ripple} />}
        </div>
        <div className={styles.groomInfo}>
          <h3 className={`${styles.sectionTitle} ${styles.groomTitle}`}>Groom</h3>
          <div
            className={`${styles.groomImageWrapperMobile} ${styles.rippleWrapper}`}
            onClick={() => triggerRipple(setGroomRipple, setGroomBio)}
          >
            <img src="/images/profile/takeshi.jpg" alt="新郎の画像" className={styles.profileImage} />
            {groomRipple && <span className={styles.ripple} />}
          </div>
          <div className={styles.nameField}>
            <span className={styles.nameText}>新田　剛志</span>
          </div>
          <div className={styles.greetingField}>
            {groomBio
              ? <BioCard data={GROOM_BIO} animate={groomBio} />
              : <span className={styles.greetingLabel}>{GROOM_GREETING.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}</span>
            }
          </div>
        </div>
      </div>

      {/* Bride */}
      <div className={styles.brideSection}>
        <div className={styles.brideInfo}>
          <h3 className={`${styles.sectionTitle} ${styles.brideTitle}`}>Bride</h3>
          <div
            className={`${styles.brideImageWrapperMobile} ${styles.rippleWrapper}`}
            onClick={() => triggerRipple(setBrideRipple, setBrideBio)}
          >
            <img src="/images/profile/na.jpg" alt="新婦の画像" className={styles.profileImage} />
            {brideRipple && <span className={styles.ripple} />}
          </div>
          <div className={styles.nameField}>
            <span className={styles.nameText}>井田　菜摘</span>
          </div>
          <div className={styles.greetingField}>
            {brideBio
              ? <BioCard data={BRIDE_BIO} animate={brideBio} />
              : <span className={styles.greetingLabel}>{BRIDE_GREETING.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}</span>
            }
          </div>
        </div>
        <div
          className={`${styles.brideImageWrapper} ${styles.rippleWrapper}`}
          onClick={() => triggerRipple(setBrideRipple, setBrideBio)}
        >
          <img src="/images/profile/na.jpg" alt="新婦の画像" className={styles.profileImage} />
          {brideRipple && <span className={styles.ripple} />}
        </div>
      </div>

      <div className={styles.waveBottom}></div>
    </div>
  )
}
