'use client'

import React, { useState, useEffect } from 'react'
import styles from './partyInfo.module.css'

interface PartyTitleProps {
  titleText: string
  visibleChars: number
}

const MOBILE_BREAKPOINT = 768
const CHAR_SPACING_PC = 12
const CHAR_SPACING_MOBILE = 8

export const PartyTitle: React.FC<PartyTitleProps> = ({ titleText, visibleChars }) => {
  const [charSpacing, setCharSpacing] = useState(CHAR_SPACING_PC)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setCharSpacing(mq.matches ? CHAR_SPACING_MOBILE : CHAR_SPACING_PC)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return (
    <div className={styles.titleWrapper}>
      <svg className={styles.titleSvg} viewBox="0 0 600 120" preserveAspectRatio="xMidYMid meet">
        {titleText.split('').map((char, index) => {
          const xPosition = 50 + (index - (titleText.length - 1) / 2) * charSpacing
          const shouldAnimate = index < visibleChars && visibleChars > 0
          return (
            <text
              key={index}
              x={`${xPosition}%`}
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-dancing-script), cursive"
              className={shouldAnimate ? styles.titleText : styles.titleTextHidden}
              style={shouldAnimate ? {
                strokeDasharray: "500",
                strokeDashoffset: "0",
                animationDelay: `${index * 0.4}s`,
              } : {
                strokeDasharray: "0",
                strokeDashoffset: "500",
                opacity: 0,
              }}
            >
              {char}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
