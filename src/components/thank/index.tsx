'use client'

import React, { useRef } from 'react'
import styles from './thank.module.css'
import type { ThankProps } from './types'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { ThankTitle } from './ThankTitle'
import turtleImage from '../../image/turtle1.jpg'
import Image from 'next/image'
import { ShellDecoration } from '../other/ShellDecoration'

export const Thank: React.FC<ThankProps> = (props) => {
  const titleText = 'THANK YOU'
  const titleWrapperRef = useRef<HTMLDivElement>(null)
  const visibleChars = useTitleAnimation(titleWrapperRef, titleText)

  return (
    <div className={styles.container}>
      <div ref={titleWrapperRef}>
        <ThankTitle titleText={titleText} visibleChars={visibleChars} />
      </div>
      <div className={styles.square}>
        <ShellDecoration className={styles.thankScallopShell} />
        <div className={styles.messageContent}>
          <div className={styles.topLines}>
            <div className={styles.line}></div>
            <div className={styles.line}></div>
          </div>
          <p className={styles.messageText}>
            感謝
          </p>
          <p className={styles.messageText}>
            本日はご多忙の中<br />
            私たち二人のためにお集まりいただき<br />
            誠にありがとうございます<br />
            皆様のおかげで<br />
            素晴らしい一日を迎えることができました<br />
            これからも温かいご指導ご鞭撻を賜りますよう<br />
            お願い申し上げます<br />
            末永くよろしくお願いいたします
          </p>
          <p className={styles.messageTextRight}>
            　　　　　　　　　　　　　　　敬具
          </p>
          <div className={styles.bottomLines}>
            <div className={styles.line}></div>
            <div className={styles.line}></div>
          </div>
        </div>
      </div>
      <Image src={turtleImage} alt="Sea Turtle" className={styles.thankTurtleImage} />
    </div>
  )
}