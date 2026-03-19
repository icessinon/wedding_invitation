import React from 'react'
import styles from './entryForm.module.css'

interface EntryFormTitleProps {
  /** 1行 or 複数行（改行で収まりやすくする） */
  titleLines: string[]
  visibleChars: number
}

const CHAR_SPACING = 8
const LINE_GAP_PERCENT = 35
const FIRST_LINE_Y_PERCENT = 18

export const EntryFormTitle: React.FC<EntryFormTitleProps> = ({ titleLines, visibleChars }) => {
  const charsWithPosition = titleLines.flatMap((line, lineIndex) =>
    line.split('').map((char, charIndex) => ({
      char,
      lineIndex,
      charIndex,
      lineLength: line.length,
      globalIndex: titleLines.slice(0, lineIndex).join('').length + charIndex,
    }))
  )

  return (
    <div className={styles.titleWrapper}>
      <svg className={styles.titleSvg} viewBox="0 0 600 320" preserveAspectRatio="xMidYMid meet">
        {charsWithPosition.map(({ char, lineIndex, charIndex, lineLength, globalIndex }) => {
          const xPosition = 50 + (charIndex - (lineLength - 1) / 2) * CHAR_SPACING
          const yPosition = FIRST_LINE_Y_PERCENT + lineIndex * LINE_GAP_PERCENT
          const shouldAnimate = globalIndex < visibleChars && visibleChars > 0
          return (
            <text
              key={`${lineIndex}-${charIndex}`}
              x={`${xPosition}%`}
              y={`${yPosition}%`}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-dancing-script), cursive"
              className={shouldAnimate ? styles.titleText : styles.titleTextHidden}
              style={shouldAnimate ? {
                strokeDasharray: "500",
                strokeDashoffset: "0",
                animationDelay: `${globalIndex * 0.1}s`,
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
