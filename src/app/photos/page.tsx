import type { Metadata } from 'next'
import Link from 'next/link'
import { PhotoShare } from '../../components/photoShare'
import styles from './photos.module.css'

export const metadata: Metadata = {
  title: 'みんなの写真 | Wedding Thanks',
  description: '結婚式当日の写真の閲覧・ダウンロード・投稿ができます。',
}

export default function PhotosPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>‹ Thank You ページへ</Link>
      </header>
      <PhotoShare />
      <footer className={styles.footer}>
        <Link href="/" className={styles.backLink}>‹ Thank You ページへ戻る</Link>
      </footer>
    </div>
  )
}
