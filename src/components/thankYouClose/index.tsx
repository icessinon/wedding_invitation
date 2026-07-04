import React from 'react'
import styles from './thankYouClose.module.css'

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

      <div className={styles.inner}>
        <p className={styles.thanksLine}>Thank you</p>
        <div className={styles.divider}>✦ ✦ ✦</div>
        <p className={styles.mainMessage}>
          たくさんのご回答
          <br />
          ありがとうございました
        </p>
        <p className={styles.subMessage}>
          当日お会いできるのを
          <br />
          心待ちにしております
        </p>
        <p className={styles.signature}>2026.07.18</p>
      </div>
    </section>
  )
}
