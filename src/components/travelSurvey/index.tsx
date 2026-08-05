'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_ACTIVITIES,
  MAX_ACTIVITY_LEN,
  MAX_DESTINATIONS,
  MAX_DESTINATION_LEN,
  MAX_NAME_LEN,
  MONTH_KEYS,
  MONTH_YEARS,
  formatActivity,
  type MonthKey,
  type SurveyActivity,
  type SurveyEntry,
} from '../../lib/travelSurvey'
import styles from './travelSurvey.module.css'

const PRESET_DESTINATIONS = ['沖縄', '北海道', '京都・大阪', '箱根・熱海', '九州', '韓国', '台湾', 'ハワイ']
const PRESET_ACTIVITIES = ['温泉', 'グルメ', '海・ビーチ', '観光・街歩き', 'スキー・スノボ', 'テーマパーク', 'キャンプ', 'のんびり']
const NAME_STORAGE_KEY = 'travel-survey-name'
const REFRESH_INTERVAL_MS = 30_000

/** やりたいこと選択の行キー。'' = いつでも、それ以外は「この月はこれがやりたい」 */
type ActivityRowKey = '' | MonthKey

type FetchState = 'loading' | 'ok' | 'error'

export function TravelSurvey() {
  const [name, setName] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])
  const [customDest, setCustomDest] = useState('')
  const [months, setMonths] = useState<MonthKey[]>([])
  const [alwaysActivities, setAlwaysActivities] = useState<string[]>([])
  const [monthWishes, setMonthWishes] = useState<Partial<Record<MonthKey, string[]>>>({})
  const [customPresets, setCustomPresets] = useState<string[]>([])
  const [customActivity, setCustomActivity] = useState('')

  const [entries, setEntries] = useState<SurveyEntry[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedName, setSubmittedName] = useState<string | null>(null)

  const [activeMonth, setActiveMonth] = useState<MonthKey | null>(null)
  const [activeDest, setActiveDest] = useState<string | null>(null)
  const [activeActivity, setActiveActivity] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/survey', { cache: 'no-store' })
      const json = (await res.json()) as { ok: boolean; entries?: SurveyEntry[] }
      if (!res.ok || !json.ok || !Array.isArray(json.entries)) throw new Error('fetch failed')
      setEntries(json.entries)
      setFetchState('ok')
    } catch {
      setFetchState((prev) => (prev === 'ok' ? 'ok' : 'error'))
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_STORAGE_KEY)
    if (saved) setName(saved)
    void fetchEntries()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchEntries()
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [fetchEntries])

  // 保存済みの名前の回答があれば、フォームに前回の選択を復元する（未入力のときだけ）
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
      setDestinations((prev) => (prev.length ? prev : mine.destinations))
      setMonths((prev) => (prev.length ? prev : MONTH_KEYS.filter((m) => mine.months.includes(m))))
      const always: string[] = []
      const byMonth: Partial<Record<MonthKey, string[]>> = {}
      const custom: string[] = []
      for (const a of mine.activities) {
        if (a.month) {
          const list = byMonth[a.month] ?? (byMonth[a.month] = [])
          if (!list.includes(a.name)) list.push(a.name)
        } else if (!always.includes(a.name)) {
          always.push(a.name)
        }
        if (!PRESET_ACTIVITIES.includes(a.name) && !custom.includes(a.name)) custom.push(a.name)
      }
      setAlwaysActivities((prev) => (prev.length ? prev : always))
      setMonthWishes((prev) => (Object.keys(prev).length ? prev : byMonth))
      setCustomPresets((prev) => (prev.length ? prev : custom))
      setSubmittedName(saved)
    }
    restoredRef.current = true
  }, [fetchState, entries])

  const customDestinations = useMemo(
    () => destinations.filter((d) => !PRESET_DESTINATIONS.includes(d)),
    [destinations]
  )

  const toggleDestination = (dest: string) => {
    setFormError(null)
    setDestinations((prev) => {
      if (prev.includes(dest)) return prev.filter((d) => d !== dest)
      if (prev.length >= MAX_DESTINATIONS) {
        setFormError(`旅行先は ${MAX_DESTINATIONS} 件まで選べます`)
        return prev
      }
      return [...prev, dest]
    })
  }

  const addCustomDestination = () => {
    const value = customDest.trim().replace(/\s+/g, ' ')
    if (!value) return
    if (value.length > MAX_DESTINATION_LEN) {
      setFormError(`旅行先は ${MAX_DESTINATION_LEN} 文字以内で入力してください`)
      return
    }
    if (!destinations.includes(value) && destinations.length >= MAX_DESTINATIONS) {
      setFormError(`旅行先は ${MAX_DESTINATIONS} 件まで選べます`)
      return
    }
    setFormError(null)
    setDestinations((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setCustomDest('')
  }

  const toggleWish = (row: ActivityRowKey, name: string) => {
    setFormError(null)
    if (row === '') {
      setAlwaysActivities((prev) =>
        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      )
    } else {
      setMonthWishes((prev) => {
        const list = prev[row] ?? []
        return {
          ...prev,
          [row]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
        }
      })
    }
  }

  const addCustomPreset = () => {
    const value = customActivity.trim().replace(/\s+/g, ' ')
    if (!value) return
    if (value.length > MAX_ACTIVITY_LEN) {
      setFormError(`やりたいことは ${MAX_ACTIVITY_LEN} 文字以内で入力してください`)
      return
    }
    setFormError(null)
    if (!PRESET_ACTIVITIES.includes(value) && !customPresets.includes(value)) {
      setCustomPresets((prev) => [...prev, value])
    }
    // 追加したものはひとまず「いつでも」を選択状態にする（月の行でも選び直せる）
    setAlwaysActivities((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setCustomActivity('')
  }

  const allActivityChips = [...PRESET_ACTIVITIES, ...customPresets]

  const toggleMonth = (month: MonthKey) => {
    setFormError(null)
    setMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : MONTH_KEYS.filter((m) => prev.includes(m) || m === month)
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim().replace(/\s+/g, ' ')
    if (!trimmedName) {
      setFormError('お名前を入力してください')
      return
    }
    if (destinations.length === 0) {
      setFormError('行きたい旅行先を 1 つ以上選んでください')
      return
    }
    if (months.length === 0) {
      setFormError('行ける月を 1 つ以上選んでください')
      return
    }

    // 「いつでも」＋ 行ける月ごとの「この月はこれがやりたい」を (やりたいこと, 月) のペアにする
    const activityPairs: SurveyActivity[] = [
      ...alwaysActivities.map((name): SurveyActivity => ({ name, month: null })),
      ...months.flatMap((m) =>
        (monthWishes[m] ?? []).map((name): SurveyActivity => ({ name, month: m }))
      ),
    ]
    if (new Set(activityPairs.map((a) => a.name)).size > MAX_ACTIVITIES) {
      setFormError(`やりたいことは合計 ${MAX_ACTIVITIES} 種類まで選べます`)
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          destinations,
          months,
          activities: activityPairs,
        }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '送信に失敗しました。時間をおいてもう一度お試しください')
      }
      window.localStorage.setItem(NAME_STORAGE_KEY, trimmedName)
      setSubmittedName(trimmedName)
      await fetchEntries()
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 集計 ──────────────────────────────────────────────
  const monthNames = useMemo(() => {
    const map = new Map<MonthKey, string[]>(MONTH_KEYS.map((m) => [m, []]))
    for (const entry of entries) {
      for (const m of MONTH_KEYS) {
        if (entry.months.includes(m)) map.get(m)!.push(entry.name)
      }
    }
    return map
  }, [entries])

  const destRanking = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const entry of entries) {
      for (const d of entry.destinations) {
        const names = map.get(d) ?? []
        names.push(entry.name)
        map.set(d, names)
      }
    }
    return [...map.entries()]
      .map(([dest, names]) => ({ dest, names }))
      .sort((a, b) => b.names.length - a.names.length || a.dest.localeCompare(b.dest, 'ja'))
  }, [entries])

  const activityRanking = useMemo(() => {
    const map = new Map<string, { person: string; month: MonthKey | null }[]>()
    for (const entry of entries) {
      for (const a of entry.activities) {
        const mentions = map.get(a.name) ?? []
        mentions.push({ person: entry.name, month: a.month })
        map.set(a.name, mentions)
      }
    }
    return [...map.entries()]
      .map(([act, mentions]) => ({
        act,
        mentions,
        people: new Set(mentions.map((m) => m.person)).size,
      }))
      .sort((a, b) => b.people - a.people || a.act.localeCompare(b.act, 'ja'))
  }, [entries])

  // 月ごとの「この月にこれがやりたい」
  const monthActivities = useMemo(() => {
    const map = new Map<MonthKey, { person: string; activity: string }[]>(
      MONTH_KEYS.map((m) => [m, []])
    )
    for (const entry of entries) {
      for (const a of entry.activities) {
        if (a.month) map.get(a.month)!.push({ person: entry.name, activity: a.name })
      }
    }
    return map
  }, [entries])

  const maxMonthCount = Math.max(1, ...MONTH_KEYS.map((m) => monthNames.get(m)!.length))
  const maxDestCount = Math.max(1, ...destRanking.map((d) => d.names.length))
  const maxActivityCount = Math.max(1, ...activityRanking.map((a) => a.people))
  const activeMonthNames = activeMonth ? monthNames.get(activeMonth)! : null
  const activeMonthWishes = activeMonth ? monthActivities.get(activeMonth)! : null
  const activeDestNames = activeDest
    ? destRanking.find((d) => d.dest === activeDest)?.names ?? []
    : null
  const activeActivityMentions = activeActivity
    ? activityRanking.find((a) => a.act === activeActivity)?.mentions ?? []
    : null

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <p className={styles.heroEyebrow}>Travel Survey</p>
        <h1 className={styles.heroTitle}>みんなで旅行アンケート</h1>
        <p className={styles.heroLead}>
          行きたい場所と行ける月を教えてください。
          <br />
          回答するとその場でみんなの結果に反映されます。
        </p>
      </header>

      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="survey-name">
            お名前
          </label>
          <input
            id="survey-name"
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
            行きたい旅行先 <small className={styles.fieldHint}>（複数OK）</small>
          </span>
          <div className={styles.chips}>
            {PRESET_DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                className={styles.chip}
                aria-pressed={destinations.includes(dest)}
                onClick={() => toggleDestination(dest)}
              >
                {dest}
              </button>
            ))}
            {customDestinations.map((dest) => (
              <button
                key={dest}
                type="button"
                className={styles.chip}
                aria-pressed
                onClick={() => toggleDestination(dest)}
              >
                {dest} ×
              </button>
            ))}
          </div>
          <div className={styles.customRow}>
            <input
              className={styles.textInput}
              type="text"
              value={customDest}
              maxLength={MAX_DESTINATION_LEN}
              placeholder="その他の行き先を入力"
              onChange={(e) => setCustomDest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomDestination()
                }
              }}
            />
            <button type="button" className={styles.addButton} onClick={addCustomDestination}>
              追加
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            行ける月 <small className={styles.fieldHint}>（2026年9月〜2027年4月・複数OK）</small>
          </span>
          <div className={styles.chips}>
            {MONTH_KEYS.map((month) => (
              <button
                key={month}
                type="button"
                className={styles.monthChip}
                aria-pressed={months.includes(month)}
                onClick={() => toggleMonth(month)}
              >
                <span className={styles.monthChipYear}>{MONTH_YEARS[month]}</span>
                {month}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            やりたいこと <small className={styles.fieldHint}>（任意・複数OK）</small>
          </span>
          <div className={styles.activityRows}>
            <div className={styles.activityRow}>
              <span className={styles.activityRowLabel}>いつでも</span>
              <div className={styles.miniChips}>
                {allActivityChips.map((act) => (
                  <button
                    key={act}
                    type="button"
                    className={styles.miniChip}
                    aria-pressed={alwaysActivities.includes(act)}
                    onClick={() => toggleWish('', act)}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>
            {months.map((month) => (
              <div key={month} className={styles.activityRow}>
                <span className={styles.activityRowLabel}>
                  {MONTH_YEARS[month]}年{month}はこれがやりたい
                </span>
                <div className={styles.miniChips}>
                  {allActivityChips.map((act) => (
                    <button
                      key={act}
                      type="button"
                      className={styles.miniChip}
                      aria-pressed={(monthWishes[month] ?? []).includes(act)}
                      onClick={() => toggleWish(month, act)}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {months.length === 0 && (
              <span className={styles.fieldHint}>
                「行ける月」を選ぶと、月ごとに「この月はこれがやりたい」も選べます
              </span>
            )}
          </div>
          <div className={styles.customRow}>
            <input
              className={styles.textInput}
              type="text"
              value={customActivity}
              maxLength={MAX_ACTIVITY_LEN}
              placeholder="チップにないやりたいことを追加"
              onChange={(e) => setCustomActivity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomPreset()
                }
              }}
            />
            <button type="button" className={styles.addButton} onClick={addCustomPreset}>
              追加
            </button>
          </div>
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
          {submitting ? '送信中…' : submittedName ? '回答を更新する' : '回答を送信する'}
        </button>
      </form>

      <div ref={resultsRef} className={styles.results}>
        <div className={styles.resultsHeader}>
          <h2 className={styles.resultsTitle}>みんなの回答</h2>
          <button type="button" className={styles.refreshButton} onClick={() => void fetchEntries()}>
            ↻ 更新
          </button>
        </div>

        {fetchState === 'loading' && <p className={styles.stateNote}>読み込み中…</p>}
        {fetchState === 'error' && (
          <p className={styles.stateNote}>結果を取得できませんでした。時間をおいて「更新」を押してください。</p>
        )}

        {fetchState === 'ok' && entries.length === 0 && (
          <p className={styles.stateNote}>まだ回答がありません。最初の回答をどうぞ！</p>
        )}

        {fetchState === 'ok' && entries.length > 0 && (
          <>
            <div className={styles.statTile}>
              <span className={styles.statValue}>{entries.length}</span>
              <span className={styles.statLabel}>人が回答済み</span>
            </div>

            <section className={styles.chartCard} aria-label="月ごとに行ける人数のグラフ">
              <h3 className={styles.chartTitle}>
                行ける月 <small className={styles.chartHint}>タップで名前を表示</small>
              </h3>
              <div className={styles.columns}>
                {MONTH_KEYS.map((month) => {
                  const names = monthNames.get(month)!
                  const heightPct = (names.length / maxMonthCount) * 100
                  return (
                    <button
                      key={month}
                      type="button"
                      className={styles.column}
                      aria-pressed={activeMonth === month}
                      aria-label={`${MONTH_YEARS[month]}年${month}：${names.length}人`}
                      onClick={() => setActiveMonth((prev) => (prev === month ? null : month))}
                    >
                      <span className={styles.columnCount}>{names.length}</span>
                      <span className={styles.columnTrack}>
                        <span
                          className={styles.columnBar}
                          style={{ height: `${Math.max(heightPct, names.length > 0 ? 6 : 0)}%` }}
                        />
                      </span>
                      <span className={styles.columnLabel}>{month}</span>
                      <span className={styles.columnYear}>{MONTH_YEARS[month]}</span>
                    </button>
                  )
                })}
              </div>
              {activeMonth && activeMonthNames && (
                <p className={styles.namesNote}>
                  <strong>
                    {MONTH_YEARS[activeMonth]}年{activeMonth}に行ける人（{activeMonthNames.length}人）
                  </strong>
                  {activeMonthNames.length > 0 ? `：${activeMonthNames.join('、')}` : '：まだいません'}
                  {activeMonthWishes && activeMonthWishes.length > 0 && (
                    <>
                      <br />
                      <strong>この月にやりたい</strong>：
                      {activeMonthWishes.map((w) => `${w.activity}（${w.person}）`).join('、')}
                    </>
                  )}
                </p>
              )}
            </section>

            <section className={styles.chartCard} aria-label="行きたい旅行先ランキングのグラフ">
              <h3 className={styles.chartTitle}>
                行きたい旅行先 <small className={styles.chartHint}>タップで名前を表示</small>
              </h3>
              <div className={styles.bars}>
                {destRanking.map(({ dest, names }) => (
                  <button
                    key={dest}
                    type="button"
                    className={styles.barRow}
                    aria-pressed={activeDest === dest}
                    aria-label={`${dest}：${names.length}人`}
                    onClick={() => setActiveDest((prev) => (prev === dest ? null : dest))}
                  >
                    <span className={styles.barLabel}>{dest}</span>
                    <span className={styles.barTrack}>
                      <span
                        className={styles.barFill}
                        style={{ width: `${(names.length / maxDestCount) * 100}%` }}
                      />
                    </span>
                    <span className={styles.barCount}>{names.length}</span>
                  </button>
                ))}
              </div>
              {activeDest && activeDestNames && (
                <p className={styles.namesNote}>
                  <strong>
                    {activeDest} に行きたい人（{activeDestNames.length}人）
                  </strong>
                  ：{activeDestNames.join('、')}
                </p>
              )}
            </section>

            {activityRanking.length > 0 && (
              <section className={styles.chartCard} aria-label="やりたいことランキングのグラフ">
                <h3 className={styles.chartTitle}>
                  やりたいこと <small className={styles.chartHint}>タップで名前を表示</small>
                </h3>
                <div className={styles.bars}>
                  {activityRanking.map(({ act, people }) => (
                    <button
                      key={act}
                      type="button"
                      className={styles.barRow}
                      aria-pressed={activeActivity === act}
                      aria-label={`${act}：${people}人`}
                      onClick={() => setActiveActivity((prev) => (prev === act ? null : act))}
                    >
                      <span className={styles.barLabel}>{act}</span>
                      <span className={styles.barTrack}>
                        <span
                          className={`${styles.barFill} ${styles.activityBarFill}`}
                          style={{ width: `${(people / maxActivityCount) * 100}%` }}
                        />
                      </span>
                      <span className={styles.barCount}>{people}</span>
                    </button>
                  ))}
                </div>
                {activeActivity && activeActivityMentions && (
                  <p className={styles.namesNote}>
                    <strong>
                      {activeActivity} をやりたい人（
                      {new Set(activeActivityMentions.map((m) => m.person)).size}人）
                    </strong>
                    ：
                    {activeActivityMentions
                      .map((m) => (m.month ? `${m.person}（${m.month}希望）` : m.person))
                      .join('、')}
                  </p>
                )}
              </section>
            )}

            <details className={styles.answerList}>
              <summary className={styles.answerListSummary}>回答一覧（{entries.length}件）</summary>
              <ul className={styles.answerItems}>
                {entries.map((entry) => (
                  <li key={entry.name} className={styles.answerItem}>
                    <span className={styles.answerName}>{entry.name}</span>
                    <span className={styles.answerDetail}>
                      行き先：{entry.destinations.join('、')}
                      <br />
                      行ける月：{entry.months.join('、')}
                      {entry.activities.length > 0 && (
                        <>
                          <br />
                          やりたいこと：{entry.activities.map(formatActivity).join('、')}
                        </>
                      )}
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
