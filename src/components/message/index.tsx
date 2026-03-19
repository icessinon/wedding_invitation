'use client'

import React, { useRef, useState } from 'react'
import styles from './message.module.css'
import type { MessageProps } from './types'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { MessageTitle } from './MessageTitle'
import { ShellDecoration } from '../other/ShellDecoration'
import turtleImage from '../../image/turtle1.jpg'
import Image from 'next/image'
import footprintGirlLeftImage from '../../image/girl-left.png'
import footprintGirlRightImage from '../../image/girl-right.png'
import footprintManLeftImage from '../../image/man-left.png'
import footprintManRightImage from '../../image/man-right.png'

interface Egg {
  id: number
  left: number
  bottom: number
  isHatching: boolean
}

export const Message: React.FC<MessageProps> = (props) => {
  const titleText = 'MESSAGE'
  const titleWrapperRef = useRef<HTMLDivElement>(null)
  const visibleChars = useTitleAnimation(titleWrapperRef, titleText)
  const [isMoving, setIsMoving] = useState(false)
  const [eggs, setEggs] = useState<Egg[]>([])
  const [showTurtle, setShowTurtle] = useState(true)
  const [eggIdCounter, setEggIdCounter] = useState(0)
  const [turtlePosition, setTurtlePosition] = useState({ left: 5, bottom: 5 })
  const [isBorn, setIsBorn] = useState(false)
  const [footprints, setFootprints] = useState<Array<{ id: number; left: number; isLeft: boolean; isMan: boolean; bottom: number; footOffset: number }>>([])
  const [footprintIdCounter, setFootprintIdCounter] = useState(0)
  const [isWalking, setIsWalking] = useState(false)
  const [isMessageFaded, setIsMessageFaded] = useState(false)

  const handleTurtleClick = () => {
    if (isMoving || !showTurtle) return
    
    const currentPosition = { ...turtlePosition }
    setIsMoving(true)
    
    setTimeout(() => {
      setEggs([{
        id: eggIdCounter,
        left: currentPosition.left,
        bottom: currentPosition.bottom,
        isHatching: false
      }])
      setEggIdCounter(prev => prev + 1)
    }, 500)
    
    setTimeout(() => {
      setIsMoving(false)
      setShowTurtle(false)
    }, 10000)
  }

  const handleEggClick = (eggId: number) => {
    const clickedEgg = eggs.find(egg => egg.id === eggId)
    if (!clickedEgg) return
    
    setEggs(prev => prev.map(egg => 
      egg.id === eggId ? { ...egg, isHatching: true } : egg
    ))
    
    setTimeout(() => {
      setEggs(prev => prev.filter(egg => egg.id !== eggId))
      setTurtlePosition({ left: clickedEgg.left, bottom: clickedEgg.bottom })
      setIsBorn(true)
      setShowTurtle(true)
      setIsMoving(false)
      
      setTimeout(() => {
        setIsBorn(false)
      }, 1000)
    }, 1000)
  }

  const handleShellClick = () => {
    if (isWalking) return
    setIsWalking(true)
    setFootprints([])
    
    setIsMessageFaded(true)
    
    const startLeft = 10
    const endLeft = 90
    const totalDistance = endLeft - startLeft
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    const horizontalSpacing = isMobile ? 4 : 2
    
    const closeStepRatio = isMobile ? 0.15 : 0.1
    const gapRatio = isMobile ? 0.85 : 0.65
    
    const pairDistance = totalDistance / 5
    const closeStepDistance = pairDistance * closeStepRatio
    const gapDistance = pairDistance * gapRatio
    const pairTotalDistance = closeStepDistance + gapDistance
    const maxPairs = Math.ceil(totalDistance / pairTotalDistance)
    const stepCount = maxPairs * 2
    const stepInterval = 500
    
    const footprintIds: number[] = []
    
    for (let i = 0; i < stepCount; i++) {
      const pairIndex = Math.floor(i / 2)
      const stepInPair = i % 2
      
      setTimeout(() => {
        let centerLeft
        if (stepInPair === 0) {
          let accumulatedDistance = 0
          for (let p = 0; p < pairIndex; p++) {
            accumulatedDistance += closeStepDistance + gapDistance
          }
          centerLeft = startLeft + accumulatedDistance
        } else {
          let accumulatedDistance = 0
          for (let p = 0; p < pairIndex; p++) {
            accumulatedDistance += closeStepDistance + gapDistance
          }
          centerLeft = startLeft + accumulatedDistance + closeStepDistance
        }
        
        if (centerLeft > endLeft) {
          return
        }
        
        const isLeftFoot = i % 2 === 0
        const manFootprintId = Date.now() + i * 2
        const manFootprint = {
          id: manFootprintId,
          left: isLeftFoot ? centerLeft - horizontalSpacing : centerLeft + horizontalSpacing,
          isLeft: isLeftFoot,
          isMan: true,
          bottom: isLeftFoot ? 58 : 54,
          footOffset: 0
        }
        
        const womanFootprintId = Date.now() + i * 2 + 1
        const womanFootprint = {
          id: womanFootprintId,
          left: isLeftFoot ? centerLeft - horizontalSpacing : centerLeft + horizontalSpacing,
          isLeft: isLeftFoot,
          isMan: false,
          bottom: isLeftFoot ? 46 : 42,
          footOffset: 0
        }
        
        footprintIds.push(manFootprintId, womanFootprintId)
        
        setFootprints(prev => [...prev, manFootprint, womanFootprint])
      }, i * stepInterval)
    }
    
    const totalDisplayTime = stepCount * stepInterval
    const fadeOutStartDelay = totalDisplayTime * 0.6
    const fadeOutInterval = 200
    
    setTimeout(() => {
      footprintIds.forEach((footprintId, index) => {
        setTimeout(() => {
          setFootprints(prev => prev.filter(fp => fp.id !== footprintId))
        }, fadeOutStartDelay + index * fadeOutInterval)
      })
      
      setTimeout(() => {
        setFootprintIdCounter(prev => prev + footprintIds.length)
        setIsWalking(false)
        setFootprints([])
        setIsMessageFaded(false)
      }, fadeOutStartDelay + footprintIds.length * fadeOutInterval)
    }, fadeOutStartDelay)
  }

  return (
    <div className={styles.container}>
      <div className={styles.oceanSection}>
        <div className={styles.wave}></div>
        <div className={styles.wave} style={{ animationDelay: '0.5s' }}></div>
        <div className={styles.wave} style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div ref={titleWrapperRef}>
        <MessageTitle titleText={titleText} visibleChars={visibleChars} />
      </div>
      <div className={styles.square}>
        <div className={styles.topLines}>
          <div className={styles.line}></div>
          <div className={styles.line}></div>
        </div>
        <div className={styles.messageContent}>
          <p className={`${styles.messageText} ${isMessageFaded ? styles.messageFaded : ''}`}>
            謹啓
          </p>
          <p className={`${styles.messageText} ${isMessageFaded ? styles.messageFaded : ''}`}>
            皆様におかれましては<br />
            ご清祥のこととお慶び申し上げます<br />
            このたび 私たちは結婚式を<br />
            挙げることになりました<br />
            つきましては 日頃お世話になっている皆様に<br />
            お集まりいただきささやかな披露宴を<br />
            催したいと存じます<br />
            ご多用中 誠に恐縮ではございますが<br />
            ご来臨の栄を賜りたく<br />
            謹んでご案内申し上げます
          </p>
          <p className={`${styles.messageTextRight} ${isMessageFaded ? styles.messageFaded : ''}`}>
            　　　　　　　　　　　　　　　謹白
          </p>
        </div>
        <div className={styles.bottomLines}>
          <div className={styles.line}></div>
          <div className={styles.line}></div>
        </div>
      </div>
      {showTurtle && (
        <Image 
          src={turtleImage} 
          alt="Sea Turtle" 
          className={`${styles.turtleImage} ${isMoving ? styles.turtleMoving : ''} ${isBorn ? styles.turtleBorn : ''}`}
          onClick={handleTurtleClick}
          style={{ 
            cursor: 'pointer',
            left: `${turtlePosition.left}%`,
            bottom: `${turtlePosition.bottom}%`
          }}
        />
      )}
      
      {eggs.map(egg => (
        <div
          key={egg.id}
          className={`${styles.turtleEgg} ${egg.isHatching ? styles.eggHatching : ''}`}
          style={{
            left: `${egg.left}%`,
            bottom: `${egg.bottom}%`,
          }}
          onClick={() => handleEggClick(egg.id)}
        />
      ))}
      
      <div 
        className={styles.shellDecoration}
        onClick={handleShellClick}
        onTouchStart={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleShellClick()
        }}
        style={{ cursor: 'pointer' }}
      >
        <ShellDecoration />
      </div>
      
      {footprints.map(footprint => {
        let footprintImage
        if (footprint.isMan) {
          footprintImage = footprint.isLeft ? footprintManLeftImage : footprintManRightImage
        } else {
          footprintImage = footprint.isLeft ? footprintGirlLeftImage : footprintGirlRightImage
        }
        
        return (
          <div
            key={footprint.id}
            className={styles.footprint}
            style={{
              left: `${footprint.left}%`,
              bottom: `${footprint.bottom}%`,
            }}
          >
            <Image
              src={footprintImage}
              alt="Footprint"
              width={60}
              height={75}
              className={`${styles.footprintImage} ${footprint.isLeft ? styles.footprintLeft : styles.footprintRight}`}
            />
          </div>
        )
      })}
    </div>
  )
}

