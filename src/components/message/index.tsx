'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import styles from './message.module.css'
import { useTitleAnimation } from '../../hooks/useTitleAnimation'
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

interface Footprint {
  id: number
  left: number
  isLeft: boolean
  isMan: boolean
  bottom: number
}

export const Message: React.FC = () => {
  const titleText = 'MESSAGE'
  const titleWrapperRef = useRef<HTMLDivElement>(null)
  const visibleChars = useTitleAnimation(titleWrapperRef, titleText)
  const [isMoving, setIsMoving] = useState(false)
  const [eggs, setEggs] = useState<Egg[]>([])
  const [showTurtle, setShowTurtle] = useState(true)
  const [eggIdCounter, setEggIdCounter] = useState(0)
  const [turtlePosition, setTurtlePosition] = useState({ left: 5, bottom: 5 })
  const [isBorn, setIsBorn] = useState(false)
  const [footprints, setFootprints] = useState<Footprint[]>([])
  const footprintIdRef = useRef(0)
  const [isWalking, setIsWalking] = useState(false)
  const [isMessageFaded, setIsMessageFaded] = useState(false)
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => { timerIds.current.forEach(clearTimeout) }
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timerIds.current.push(id)
    return id
  }, [])

  const handleTurtleClick = useCallback(() => {
    if (isMoving || !showTurtle) return

    const currentPosition = { ...turtlePosition }
    setIsMoving(true)

    schedule(() => {
      setEggs([{
        id: eggIdCounter,
        left: currentPosition.left,
        bottom: currentPosition.bottom,
        isHatching: false
      }])
      setEggIdCounter(prev => prev + 1)
    }, 500)

    schedule(() => {
      setIsMoving(false)
      setShowTurtle(false)
    }, 10000)
  }, [isMoving, showTurtle, turtlePosition, eggIdCounter, schedule])

  const handleEggClick = useCallback((eggId: number) => {
    const clickedEgg = eggs.find(egg => egg.id === eggId)
    if (!clickedEgg) return

    setEggs(prev => prev.map(egg =>
      egg.id === eggId ? { ...egg, isHatching: true } : egg
    ))

    schedule(() => {
      setEggs(prev => prev.filter(egg => egg.id !== eggId))
      setTurtlePosition({ left: clickedEgg.left, bottom: clickedEgg.bottom })
      setIsBorn(true)
      setShowTurtle(true)
      setIsMoving(false)

      schedule(() => { setIsBorn(false) }, 1000)
    }, 1000)
  }, [eggs, schedule])

  const handleShellClick = useCallback(() => {
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

      schedule(() => {
        let accumulatedDistance = 0
        for (let p = 0; p < pairIndex; p++) {
          accumulatedDistance += closeStepDistance + gapDistance
        }
        const centerLeft = startLeft + accumulatedDistance + (stepInPair === 1 ? closeStepDistance : 0)

        if (centerLeft > endLeft) return

        const isLeftFoot = i % 2 === 0
        const manId = ++footprintIdRef.current
        const womanId = ++footprintIdRef.current
        footprintIds.push(manId, womanId)

        setFootprints(prev => [...prev,
          { id: manId,   left: isLeftFoot ? centerLeft - horizontalSpacing : centerLeft + horizontalSpacing, isLeft: isLeftFoot, isMan: true,  bottom: isLeftFoot ? 58 : 54 },
          { id: womanId, left: isLeftFoot ? centerLeft - horizontalSpacing : centerLeft + horizontalSpacing, isLeft: isLeftFoot, isMan: false, bottom: isLeftFoot ? 46 : 42 },
        ])
      }, i * stepInterval)
    }

    const totalDisplayTime = stepCount * stepInterval
    const fadeOutStartDelay = totalDisplayTime * 0.6
    const fadeOutInterval = 200

    schedule(() => {
      footprintIds.forEach((id, index) => {
        schedule(() => {
          setFootprints(prev => prev.filter(fp => fp.id !== id))
        }, fadeOutStartDelay + index * fadeOutInterval)
      })

      schedule(() => {
        setIsWalking(false)
        setFootprints([])
        setIsMessageFaded(false)
      }, fadeOutStartDelay + footprintIds.length * fadeOutInterval)
    }, fadeOutStartDelay)
  }, [isWalking, schedule])

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
            葉桜の候<br />
            ご清祥のこととお慶び申し上げます<br />
            このたび 私たちは結婚式を<br />
            挙げることになりました<br />
            つきましては 日頃お世話になっている<br />
            皆様に<br />
            お集まりいただきささやかな披露宴を<br />
            催したいと存じます<br />
            ご多用中 誠に恐縮ではございますが<br />
            ご来臨の栄を賜りたく<br />
            謹んでご案内申し上げます
          </p>
          <p className={`${styles.messageTextRight} ${isMessageFaded ? styles.messageFaded : ''}`}>
            　　　　　　　　　　　　　　　謹白
            <br />
            2026年4月吉日
            <br />
            新田剛志  井田菜摘
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
        const footprintImage = footprint.isMan
          ? (footprint.isLeft ? footprintManLeftImage : footprintManRightImage)
          : (footprint.isLeft ? footprintGirlLeftImage : footprintGirlRightImage)

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
