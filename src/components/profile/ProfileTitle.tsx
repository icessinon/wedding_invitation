import React from 'react'
import styles from './profile.module.css'

interface ProfileTitleProps {
  titleText: string
  visibleChars: number
}

export const ProfileTitle: React.FC<ProfileTitleProps> = ({ titleText, visibleChars }) => {
  return (
    <div className={styles.titleWrapper}>
      <svg className={styles.titleSvg} viewBox="0 0 600 120" preserveAspectRatio="xMidYMid meet">
        {titleText.split('').map((char, index) => {
          const xPosition = 50 + (index - (titleText.length - 1) / 2) * 12
          const shouldAnimate = index < visibleChars && visibleChars > 0
          return (
            <text
              key={index}
              x={`${xPosition}%`}
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="70"
              fontFamily="var(--font-dancing-script), cursive"
              className={shouldAnimate ? styles.titleText : styles.titleTextHidden}
              style={shouldAnimate ? {
                strokeDasharray: "500",
                strokeDashoffset: "0",
                animationDelay: `${index * 0.15}s`,
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

