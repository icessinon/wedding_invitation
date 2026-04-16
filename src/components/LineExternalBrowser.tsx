'use client'

import { useEffect } from 'react'

export function LineExternalBrowser() {
  useEffect(() => {
    if (!/Line\//i.test(navigator.userAgent)) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('openExternalBrowser') === '1') return
    url.searchParams.set('openExternalBrowser', '1')
    window.location.replace(url.toString())
  }, [])
  return null
}
