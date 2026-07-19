import React from 'react'
import styles from './thankYouClose.module.css'
import { SailingHorizon } from '../ocean'

const BUBBLE_SEA_COUNT = 240

export const ThankYouClose: React.FC = () => {
  return (
    <section className={styles.container}>
      <div className={styles.bubbleSea} aria-hidden="true">
        {Array.from({ length: BUBBLE_SEA_COUNT }, (_, i) => {
          const left = ((i * 43 + 17) % 89) + 5
          const size = 2 + (i % 5) + (i % 7 === 0 ? 1 : 0) + (i % 11 === 0 ? 1 : 0)
          const duration = 14 + ((i * 53 + (i % 13) * 37) % 296)
          const delay = -((i * 0.31) % 20)
          return (
            <span
              key={i}
              className={styles.bubbleSeaParticle}
              style={{
                left: `${left}%`,
                width: size,
                height: size,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          )
        })}
      </div>

      <SailingHorizon />

      <div className={styles.inner}>
        <p className={styles.thanksLine}>With gratitude</p>
        <div className={styles.divider}>✦ ✦ ✦</div>
        <p className={styles.mainMessage}>
          素敵な一日を
          <br />
          ありがとうございました
        </p>
        <p className={styles.subMessage}>
          これからも 私たち二人を
          <br />
          あたたかく見守っていただけますと
          <br />
          幸いです
        </p>
        <p className={styles.signature}>
          2026.07.18 指帆亭にて
          <br />
          Takeshi &amp; Natsumi
        </p>
      </div>
    </section>
  )
}
