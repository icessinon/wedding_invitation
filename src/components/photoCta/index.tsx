import React from 'react'
import Link from 'next/link'
import styles from './photoCta.module.css'
import { RisingBubbles } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'

/** トップページから写真ページ（/photos）への誘導セクション */
export const PhotoCta: React.FC = () => (
  <section className={styles.container}>
    <RisingBubbles count={18} />
    <div className={styles.inner}>
      <SectionTitle en="Photo Gallery" />
      <p className={styles.text}>
        当日の写真を集めています
        <br />
        皆様の写真も ぜひお送りください
      </p>
      <Link href="/photos" className={styles.button}>
        <span className={styles.buttonIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <circle cx="12" cy="12.5" r="3.5" />
          </svg>
        </span>
        みんなの写真をみる・おくる
      </Link>
      <p className={styles.note}>閲覧・ダウンロード・投稿ができます</p>
    </div>
  </section>
)
