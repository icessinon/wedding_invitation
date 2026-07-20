'use client'

import React, { useEffect, useState } from 'react'
import styles from './photoShare.module.css'

type InAppEnv = 'line' | 'inapp' | null

/**
 * LINE や Instagram などのアプリ内ブラウザでは写真・動画の保存ができないため、
 * 外部ブラウザで開くよう促すバナー。
 */
export const ExternalBrowserNotice: React.FC = () => {
  const [env, setEnv] = useState<InAppEnv>(null)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsAndroid(/Android/i.test(ua))
    if (/Line\//i.test(ua)) {
      setEnv('line')
    } else if (/(Instagram|FBAN|FBAV|FB_IAB|Twitter)/i.test(ua)) {
      setEnv('inapp')
    }
  }, [])

  if (!env) return null

  const openExternal = () => {
    const url = new URL(window.location.href)
    if (env === 'line') {
      // LINE は openExternalBrowser=1 で外部ブラウザ起動
      url.searchParams.set('openExternalBrowser', '1')
      window.location.href = url.toString()
      return
    }
    if (isAndroid) {
      // Android は intent: で Chrome を起動
      const bare = url.toString().replace(/^https?:\/\//, '')
      window.location.href = `intent://${bare}#Intent;scheme=https;end`
    }
  }

  return (
    <div className={styles.externalNotice} role="alert">
      <p className={styles.externalNoticeText}>
        アプリ内のブラウザでは写真・動画の保存ができないことがあります
      </p>
      {env === 'line' || isAndroid ? (
        <button type="button" className={styles.externalNoticeButton} onClick={openExternal}>
          ブラウザで開き直す
        </button>
      ) : (
        <p className={styles.externalNoticeSub}>
          右下の「…」メニューから「Safariで開く」を選んでください
        </p>
      )}
    </div>
  )
}
