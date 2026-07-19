import React from 'react'
import styles from './thanksMessage.module.css'
import { RisingBubbles } from '../ocean'
import { SectionTitle } from '../ocean/SectionTitle'

export const ThanksMessage: React.FC = () => {
  return (
    <section className={styles.container}>
      <div className={styles.glow} aria-hidden="true" />
      <RisingBubbles count={26} />

      <SectionTitle en="Thanks" ja="ご列席の御礼" />

      <div className={styles.card}>
        <div className={styles.cornerTopLeft} aria-hidden="true" />
        <div className={styles.cornerBottomRight} aria-hidden="true" />

        <p className={styles.opening}>謹啓</p>
        <p className={styles.body}>
          このたびは 私たちの結婚式に
          <br />
          ご列席を賜り
          <br />
          誠にありがとうございました
        </p>
        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerLine} />
          <span className={styles.dividerMark}>✦</span>
          <span className={styles.dividerLine} />
        </div>
        <p className={styles.body}>
          皆様の温かなお祝いに包まれて
          <br />
          かけがえのない一日を
          <br />
          迎えることができました
          <br />
          これからは 二人で力を合わせ
          <br />
          明るい家庭を築いてまいります
          <br />
          今後とも変わらぬお付き合いのほど
          <br />
          よろしくお願い申し上げます
        </p>
        <p className={styles.closing}>謹白</p>
        <p className={styles.signature}>
          2026年7月吉日
          <br />
          新田剛志・菜摘
        </p>
      </div>
    </section>
  )
}
