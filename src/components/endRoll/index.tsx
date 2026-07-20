import React from 'react'
import styles from './endRoll.module.css'
import { RisingBubbles } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'

/** Drive にアップロード済みのエンドロールムービーのファイルID */
const ENDROLL_FILE_ID = '15qaL1-D9QCaNNszKHS4SUBVS_AUE565A'

export const EndRoll: React.FC = () => (
  <section className={styles.container}>
    <RisingBubbles count={20} />
    <SectionTitle en="End Roll" ja="エンドロールムービー" />

    <div className={styles.videoWrap}>
      <video
        className={styles.video}
        src={`/api/photos/stream/${ENDROLL_FILE_ID}`}
        poster={`https://lh3.googleusercontent.com/d/${ENDROLL_FILE_ID}=w1280`}
        controls
        playsInline
        preload="none"
      />
    </div>

    <p className={styles.note}>披露宴で上映したエンドロールをご覧いただけます</p>
  </section>
)
