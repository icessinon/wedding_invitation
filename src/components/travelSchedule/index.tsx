'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_NAME_LEN,
  MONTH_PLANS,
  SCHEDULE_MONTHS,
  WEEKDAY_LABELS,
  allScheduleDates,
  formatDateLabel,
  formatDateShort,
  monthDates,
  nextDate,
  parseDateKey,
  weekdayOf,
  type DateKey,
  type ScheduleEntry,
} from '../../lib/travelSchedule'
import { MONTH_KEYS, type MonthKey, type SurveyEntry } from '../../lib/travelSurvey'
import styles from './travelSchedule.module.css'

/** 旅行アンケートと同じキー。名前を入れ直さなくて済むように共有する */
const NAME_STORAGE_KEY = 'travel-survey-name'
const REFRESH_INTERVAL_MS = 30_000

/** 候補として出す連泊の長さ（1=日帰り） */
const WINDOW_LENGTHS = [1, 2, 3] as const
const WINDOW_LABELS: Record<number, string> = { 1: '日帰り', 2: '1泊2日', 3: '2泊3日' }

type FetchState = 'loading' | 'ok' | 'error'

type Window = {
  key: string
  length: number
  days: DateKey[]
  names: string[]
}

export function TravelSchedule() {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<DateKey>>(() => new Set())

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [surveyEntries, setSurveyEntries] = useState<SurveyEntry[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedName, setSubmittedName] = useState<string | null>(null)

  const [monthIndex, setMonthIndex] = useState(0)
  const [activeDate, setActiveDate] = useState<DateKey | null>(null)

  const resultsRef = useRef<HTMLDivElement | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [scheduleRes, surveyRes] = await Promise.all([
        fetch('/api/schedule', { cache: 'no-store' }),
        fetch('/api/survey', { cache: 'no-store' }),
      ])
      const scheduleJson = (await scheduleRes.json()) as { ok: boolean; entries?: ScheduleEntry[] }
      if (!scheduleRes.ok || !scheduleJson.ok || !Array.isArray(scheduleJson.entries)) {
        throw new Error('fetch failed')
      }
      setEntries(scheduleJson.entries)
      // アンケートのまとめは取れなくても日程調整は使えるようにする
      if (surveyRes.ok) {
        const surveyJson = (await surveyRes.json()) as { ok: boolean; entries?: SurveyEntry[] }
        if (surveyJson.ok && Array.isArray(surveyJson.entries)) setSurveyEntries(surveyJson.entries)
      }
      setFetchState('ok')
    } catch {
      setFetchState((prev) => (prev === 'ok' ? 'ok' : 'error'))
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_STORAGE_KEY)
    if (saved) setName(saved)
    void fetchAll()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAll()
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [fetchAll])

  // 保存済みの名前の回答があれば、前回選んだ日を復元する（まだ何も選んでいないときだけ）
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || fetchState !== 'ok') return
    const saved = window.localStorage.getItem(NAME_STORAGE_KEY)
    if (!saved) {
      restoredRef.current = true
      return
    }
    const mine = entries.find((e) => e.name === saved)
    if (mine) {
      setSelected((prev) => (prev.size ? prev : new Set(mine.dates)))
      setSubmittedName(saved)
    }
    restoredRef.current = true
  }, [fetchState, entries])

  const toggleDate = (date: DateKey) => {
    setFormError(null)
    setActiveDate(date)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const toggleWeekends = (year: number, month: number) => {
    setFormError(null)
    const weekends = monthDates(year, month).filter((d) => [0, 6].includes(weekdayOf(d)))
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = weekends.every((d) => next.has(d))
      for (const d of weekends) {
        if (allOn) next.delete(d)
        else next.add(d)
      }
      return next
    })
  }

  const clearMonth = (year: number, month: number) => {
    setFormError(null)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const d of monthDates(year, month)) next.delete(d)
      return next
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim().replace(/\s+/g, ' ')
    if (!trimmedName) {
      setFormError('お名前を入力してください')
      return
    }
    if (selected.size === 0) {
      setFormError('行ける日を 1 日以上選んでください')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, dates: [...selected].sort() }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '送信に失敗しました。時間をおいてもう一度お試しください')
      }
      window.localStorage.setItem(NAME_STORAGE_KEY, trimmedName)
      setSubmittedName(trimmedName)
      await fetchAll()
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 集計 ──────────────────────────────────────────────

  /** 日付 → その日に行ける人の名前 */
  const namesByDate = useMemo(() => {
    const map = new Map<DateKey, string[]>()
    for (const entry of entries) {
      for (const d of entry.dates) {
        const names = map.get(d) ?? []
        names.push(entry.name)
        map.set(d, names)
      }
    }
    return map
  }, [entries])

  const answered = entries.length

  /** 連続する日をまとめた候補（日帰り・1泊2日・2泊3日）。人数が多い順に上位だけ出す */
  const bestWindows = useMemo(() => {
    const byLength = new Map<number, Window[]>()
    for (const length of WINDOW_LENGTHS) {
      const found: Window[] = []
      for (const start of allScheduleDates()) {
        const days: DateKey[] = [start]
        let cursor: DateKey | null = start
        for (let i = 1; i < length; i += 1) {
          cursor = cursor ? nextDate(cursor) : null
          if (!cursor) break
          days.push(cursor)
        }
        if (days.length < length) continue
        // 全日程に参加できる人だけを数える
        const names = (namesByDate.get(days[0]) ?? []).filter((n) =>
          days.every((d) => (namesByDate.get(d) ?? []).includes(n))
        )
        if (names.length === 0) continue
        found.push({ key: `${length}-${start}`, length, days, names })
      }
      found.sort((a, b) => b.names.length - a.names.length || a.days[0].localeCompare(b.days[0]))
      // 日程が重なる候補は上位のものだけ残す
      const picked: Window[] = []
      for (const w of found) {
        if (picked.some((p) => p.days.some((d) => w.days.includes(d)))) continue
        picked.push(w)
        if (picked.length >= 3) break
      }
      byLength.set(length, picked)
    }
    return byLength
  }, [namesByDate])

  /** アンケート（行ける月・行き先・やりたいこと）の 11 月以降だけのまとめ */
  const surveySummary = useMemo(() => {
    const scheduleMonthKeys = SCHEDULE_MONTHS.map((m) => `${m.month}月` as MonthKey).filter((m) =>
      MONTH_KEYS.includes(m)
    )
    const monthNames = new Map<MonthKey, string[]>(scheduleMonthKeys.map((m) => [m, []]))
    const destCount = new Map<string, number>()
    const actCount = new Map<string, number>()
    for (const entry of surveyEntries) {
      for (const m of scheduleMonthKeys) {
        if (entry.months.includes(m)) monthNames.get(m)!.push(entry.name)
      }
      for (const d of entry.destinations) destCount.set(d, (destCount.get(d) ?? 0) + 1)
      for (const a of new Set(entry.activities.map((x) => x.name))) {
        actCount.set(a, (actCount.get(a) ?? 0) + 1)
      }
    }
    const rank = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'))
        .slice(0, 5)
    return {
      people: surveyEntries.length,
      monthKeys: scheduleMonthKeys,
      monthNames,
      destinations: rank(destCount),
      activities: rank(actCount),
    }
  }, [surveyEntries])

  const current = SCHEDULE_MONTHS[monthIndex]
  const currentPlan = MONTH_PLANS.find((p) => p.year === current.year && p.month === current.month)
  const currentDates = monthDates(current.year, current.month)
  const leadingBlanks = weekdayOf(currentDates[0])
  const selectedInMonth = currentDates.filter((d) => selected.has(d)).length
  const maxSurveyMonth = Math.max(
    1,
    ...surveySummary.monthKeys.map((m) => surveySummary.monthNames.get(m)!.length)
  )
  const activeNames = activeDate ? namesByDate.get(activeDate) ?? [] : null
  const missingNames = activeDate
    ? entries.filter((e) => !e.dates.includes(activeDate)).map((e) => e.name)
    : []

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <p className={styles.heroEyebrow}>Trip Schedule</p>
        <h1 className={styles.heroTitle}>行ける日を教えて！</h1>
        <p className={styles.heroLead}>
          旅行アンケートの結果から、月ごとの候補を用意しました。
          <br />
          カレンダーで行ける日を選ぶだけでOKです。
        </p>
        <Link className={styles.heroLink} href="/survey">
          旅行アンケートの結果を見る →
        </Link>
      </header>

      <section className={styles.summaryCard} aria-label="旅行アンケートのまとめ">
        <h2 className={styles.sectionTitle}>
          アンケートのまとめ
          <small className={styles.sectionHint}>11月以降・{surveySummary.people}人の回答</small>
        </h2>
        <div className={styles.summaryBlock}>
          <h3 className={styles.summaryLabel}>行ける月</h3>
          <div className={styles.columns}>
            {surveySummary.monthKeys.map((m) => {
              const count = surveySummary.monthNames.get(m)!.length
              return (
                <div key={m} className={styles.column}>
                  <span className={styles.columnCount}>{count}</span>
                  <span className={styles.columnTrack}>
                    <span
                      className={styles.columnBar}
                      style={{ height: `${count === 0 ? 0 : Math.max((count / maxSurveyMonth) * 100, 6)}%` }}
                    />
                  </span>
                  <span className={styles.columnLabel}>{m}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryBlock}>
            <h3 className={styles.summaryLabel}>行きたい旅行先</h3>
            <ul className={styles.rankList}>
              {surveySummary.destinations.map(({ label, count }) => (
                <li key={label} className={styles.rankItem}>
                  <span>{label}</span>
                  <span className={styles.rankCount}>{count}人</span>
                </li>
              ))}
              {surveySummary.destinations.length === 0 && (
                <li className={styles.rankItem}>まだ回答がありません</li>
              )}
            </ul>
          </div>
          <div className={styles.summaryBlock}>
            <h3 className={styles.summaryLabel}>やりたいこと</h3>
            <ul className={styles.rankList}>
              {surveySummary.activities.map(({ label, count }) => (
                <li key={label} className={styles.rankItem}>
                  <span>{label}</span>
                  <span className={styles.rankCount}>{count}人</span>
                </li>
              ))}
              {surveySummary.activities.length === 0 && (
                <li className={styles.rankItem}>まだ回答がありません</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="schedule-name">
            お名前
          </label>
          <input
            id="schedule-name"
            className={styles.textInput}
            type="text"
            value={name}
            maxLength={MAX_NAME_LEN}
            placeholder="例：新田 岳"
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value)
              setFormError(null)
            }}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            行ける日 <small className={styles.fieldHint}>（月をめくって複数選べます）</small>
          </span>

          <div className={styles.monthTabs}>
            {SCHEDULE_MONTHS.map((m, i) => {
              const plan = MONTH_PLANS.find((p) => p.year === m.year && p.month === m.month)
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  className={styles.monthTab}
                  aria-pressed={i === monthIndex}
                  onClick={() => setMonthIndex(i)}
                >
                  <span className={styles.monthTabMonth}>{m.month}月</span>
                  <span className={styles.monthTabTitle}>{plan?.title ?? ''}</span>
                </button>
              )
            })}
          </div>

          {currentPlan && (
            <div className={styles.planCard}>
              <p className={styles.planHeading}>
                <span className={styles.planMonth}>
                  {currentPlan.year}年{currentPlan.month}月
                </span>
                <span className={styles.planTitle}>{currentPlan.title}</span>
              </p>
              <p className={styles.planMeta}>
                行き先候補：{currentPlan.destinations.join('・')}
                <br />
                やること候補：{currentPlan.activities.join('・')}
              </p>
              <p className={styles.planNote}>{currentPlan.note}</p>
            </div>
          )}

          <div className={styles.calendarHeader}>
            <button
              type="button"
              className={styles.navButton}
              disabled={monthIndex === 0}
              onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
              aria-label="前の月"
            >
              ‹
            </button>
            <span className={styles.calendarMonth}>
              {current.year}年{current.month}月
              <small className={styles.calendarPicked}>選択 {selectedInMonth}日</small>
            </span>
            <button
              type="button"
              className={styles.navButton}
              disabled={monthIndex === SCHEDULE_MONTHS.length - 1}
              onClick={() => setMonthIndex((i) => Math.min(SCHEDULE_MONTHS.length - 1, i + 1))}
              aria-label="次の月"
            >
              ›
            </button>
          </div>

          <div className={styles.calendar} role="group" aria-label={`${current.year}年${current.month}月のカレンダー`}>
            {WEEKDAY_LABELS.map((w, i) => (
              <span
                key={w}
                className={`${styles.weekday} ${i === 0 ? styles.sunday : ''} ${i === 6 ? styles.saturday : ''}`}
              >
                {w}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} className={styles.blank} />
            ))}
            {currentDates.map((date) => {
              const day = parseDateKey(date)!.day
              const count = (namesByDate.get(date) ?? []).length
              const weekday = weekdayOf(date)
              const everyone = answered > 1 && count === answered
              return (
                <button
                  key={date}
                  type="button"
                  className={`${styles.day} ${weekday === 0 ? styles.sunday : ''} ${
                    weekday === 6 ? styles.saturday : ''
                  } ${everyone ? styles.dayAll : ''}`}
                  aria-pressed={selected.has(date)}
                  aria-label={`${formatDateLabel(date)}${count > 0 ? `：${count}人が行ける` : ''}`}
                  onClick={() => toggleDate(date)}
                >
                  <span className={styles.dayNumber}>{day}</span>
                  {count > 0 && <span className={styles.dayCount}>{count}</span>}
                  {answered > 0 && (
                    <span className={styles.dayTrack}>
                      <span className={styles.dayFill} style={{ width: `${(count / answered) * 100}%` }} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className={styles.calendarActions}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => toggleWeekends(current.year, current.month)}
            >
              土日をまとめて選ぶ
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => clearMonth(current.year, current.month)}
            >
              この月の選択を消す
            </button>
          </div>

          {activeDate && (
            <p className={styles.namesNote}>
              <strong>{formatDateLabel(activeDate)}</strong>
              {selected.has(activeDate) ? '（あなた：行ける）' : '（あなた：未選択）'}
              <br />
              行ける人（{activeNames?.length ?? 0}人）：
              {activeNames && activeNames.length > 0 ? activeNames.join('、') : 'まだいません'}
              {missingNames.length > 0 && (
                <>
                  <br />
                  行けない人：{missingNames.join('、')}
                </>
              )}
            </p>
          )}
        </div>

        {formError && (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        )}
        {submittedName && !formError && (
          <p className={styles.success}>
            「{submittedName}」さんの回答を受け付けました。同じ名前でもう一度送ると上書きされます。
          </p>
        )}

        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting
            ? '送信中…'
            : submittedName
              ? `行ける日を更新する（${selected.size}日）`
              : `行ける日を送信する（${selected.size}日）`}
        </button>
      </form>

      <div ref={resultsRef} className={styles.results}>
        <div className={styles.resultsHeader}>
          <h2 className={styles.resultsTitle}>みんなの空き状況</h2>
          <button type="button" className={styles.refreshButton} onClick={() => void fetchAll()}>
            ↻ 更新
          </button>
        </div>

        {fetchState === 'loading' && <p className={styles.stateNote}>読み込み中…</p>}
        {fetchState === 'error' && (
          <p className={styles.stateNote}>結果を取得できませんでした。時間をおいて「更新」を押してください。</p>
        )}

        {fetchState === 'ok' && answered === 0 && (
          <p className={styles.stateNote}>まだ回答がありません。最初の回答をどうぞ！</p>
        )}

        {fetchState === 'ok' && answered > 0 && (
          <>
            <div className={styles.statTile}>
              <span className={styles.statValue}>{answered}</span>
              <span className={styles.statLabel}>人が回答済み</span>
            </div>

            {WINDOW_LENGTHS.map((length) => {
              const windows = bestWindows.get(length) ?? []
              if (windows.length === 0) return null
              return (
                <section key={length} className={styles.chartCard} aria-label={`${WINDOW_LABELS[length]}の候補`}>
                  <h3 className={styles.chartTitle}>
                    {WINDOW_LABELS[length]}の候補
                    <small className={styles.chartHint}>そろう人数が多い順</small>
                  </h3>
                  <ul className={styles.windowList}>
                    {windows.map((w) => {
                      const plan = MONTH_PLANS.find(
                        (p) =>
                          p.year === parseDateKey(w.days[0])!.year &&
                          p.month === parseDateKey(w.days[0])!.month
                      )
                      return (
                        <li key={w.key} className={styles.windowItem}>
                          <span className={styles.windowDate}>
                            {w.length === 1
                              ? formatDateShort(w.days[0])
                              : `${formatDateShort(w.days[0])}〜${formatDateShort(w.days[w.days.length - 1])}`}
                          </span>
                          <span className={styles.windowMeta}>
                            <strong className={styles.windowCount}>{w.names.length}人</strong>
                            {w.names.length === answered && <span className={styles.windowBadge}>全員OK</span>}
                            {plan && <span className={styles.windowPlan}>{plan.title}</span>}
                            <br />
                            {w.names.join('、')}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            <details className={styles.answerList}>
              <summary className={styles.answerListSummary}>回答一覧（{answered}件）</summary>
              <ul className={styles.answerItems}>
                {entries.map((entry) => (
                  <li key={entry.name} className={styles.answerItem}>
                    <span className={styles.answerName}>
                      {entry.name}
                      <small className={styles.answerDays}>{entry.dates.length}日</small>
                    </span>
                    <span className={styles.answerDetail}>
                      {entry.dates.map((d) => formatDateShort(d)).join('、') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
