import React from 'react'
import styles from './album.module.css'

export const CoralDecoration: React.FC = () => {
  return (
    <>
      <div className={styles.coralLeft}>
        <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
          <path d="M100,300 Q80,250 90,200 T100,150 Q110,100 100,50 Q90,20 100,0" 
                fill="rgba(255,255,255,0.15)" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="2"/>
          <path d="M50,300 Q40,250 50,200 T60,150 Q55,100 50,50 Q45,20 50,0" 
                fill="rgba(255,255,255,0.12)" 
                stroke="rgba(255,255,255,0.18)" 
                strokeWidth="1.5"/>
          <path d="M150,300 Q160,250 150,200 T140,150 Q145,100 150,50 Q155,20 150,0" 
                fill="rgba(255,255,255,0.12)" 
                stroke="rgba(255,255,255,0.18)" 
                strokeWidth="1.5"/>
        </svg>
      </div>
      <div className={styles.coralRight}>
        <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
          <path d="M100,300 Q120,250 110,200 T100,150 Q90,100 100,50 Q110,20 100,0" 
                fill="rgba(255,255,255,0.15)" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="2"/>
          <path d="M50,300 Q60,250 50,200 T40,150 Q45,100 50,50 Q55,20 50,0" 
                fill="rgba(255,255,255,0.12)" 
                stroke="rgba(255,255,255,0.18)" 
                strokeWidth="1.5"/>
          <path d="M150,300 Q140,250 150,200 T160,150 Q155,100 150,50 Q145,20 150,0" 
                fill="rgba(255,255,255,0.12)" 
                stroke="rgba(255,255,255,0.18)" 
                strokeWidth="1.5"/>
        </svg>
      </div>
    </>
  )
}
