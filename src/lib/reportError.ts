'use client'

/**
 * ゲスト側で起きたエラーを新郎新婦へ報告する（fire-and-forget）。
 * 失敗してもゲストの操作には一切影響させない。
 */

let sentCount = 0
const MAX_REPORTS_PER_SESSION = 5

export function reportError(context: string, message: string): void {
  if (typeof window === 'undefined') return
  if (sentCount >= MAX_REPORTS_PER_SESSION) return
  sentCount++
  try {
    const payload = JSON.stringify({
      context,
      message,
      userAgent: navigator.userAgent,
      page: window.location.pathname,
    })
    // ページ離脱時でも送信されやすい sendBeacon を優先
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/report-error', blob)
    } else {
      void fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // 報告できなくても無視
  }
}
