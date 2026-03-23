'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './entryForm.module.css'
import type { EntryFormProps } from './types'
import { RELATIONSHIP_OPTIONS } from './relationshipOptions'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { EntryFormTitle } from './EntryFormTitle'

const ENTRY_TITLE_LINES = ['PRESENCE', 'OR', 'ABSENCE']
const ENTRY_TITLE_TEXT = ENTRY_TITLE_LINES.join('')

const MAX_RSVP_PHOTOS = 10
const MAX_PHOTO_BYTES = 15 * 1024 * 1024

type ImageItem = { id: string; file: File; previewUrl: string }

function newImageItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 背景の深海風・常時上昇する小泡の個数 */
const BUBBLE_SEA_COUNT = 44

export const EntryForm: React.FC<EntryFormProps> = ({ responseDeadline = '2026年○月○日' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const visibleChars = useTitleAnimation(containerRef, ENTRY_TITLE_TEXT)
  const [imageItems, setImageItems] = useState<ImageItem[]>([])
  const [hasChildrenChoice, setHasChildrenChoice] = useState<'yes' | 'no' | ''>('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOutcome, setSubmitOutcome] = useState<'attend' | 'absent' | null>(null)

  const imageItemsRef = useRef(imageItems)
  imageItemsRef.current = imageItems

  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    setImageItems((prev) => {
      const next = [...prev]
      for (let i = 0; i < list.length && next.length < MAX_RSVP_PHOTOS; i++) {
        const file = list[i]
        if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_BYTES) continue
        next.push({ id: newImageItemId(), file, previewUrl: URL.createObjectURL(file) })
      }
      return next
    })
    e.target.value = ''
  }

  const handlePhotoChangeClick = () => {
    photoInputRef.current?.click()
  }

  const removeImageItem = (id: string) => {
    setImageItems((prev) => {
      const item = prev.find((x) => x.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }

  const handlePhotoRemoveAll = () => {
    setImageItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      return []
    })
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitOutcome(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    for (const item of imageItems) {
      formData.append('photo', item.file)
    }
    const attendance = String(formData.get('attendance') ?? '')

    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        body: formData,
      })
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !payload?.ok) {
        setSubmitStatus('error')
        setSubmitError(payload?.error ?? '送信に失敗しました')
        return
      }
      if (attendance === 'attend' || attendance === 'absent') {
        setSubmitOutcome(attendance)
      }
      setSubmitStatus('ok')
      setHasChildrenChoice('')
      setImageItems((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
        return []
      })
      if (photoInputRef.current) photoInputRef.current.value = ''
      form.reset()
    } catch (err) {
      setSubmitStatus('error')
      setSubmitError(err instanceof Error ? err.message : '送信に失敗しました')
    }
  }

  return (
    <section ref={containerRef} className={styles.container} id="entry">
      <div className={styles.bubbleSea} aria-hidden="true">
        {Array.from({ length: BUBBLE_SEA_COUNT }, (_, i) => {
          const left = ((i * 41 + 11) % 86) + 7
          const size = 2 + (i % 5) + (i % 7 === 0 ? 1 : 0)
          /* 上昇時間 約20〜300秒（最大5分） */
          const duration = 20 + ((i * 53 + (i % 13) * 37) % 281)
          const delay = -((i * 0.38) % 16)
          return (
            <span
              key={i}
              className={styles.bubbleSeaParticle}
              style={{
                left: `${left}%`,
                width: size,
                height: size,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          )
        })}
      </div>
      <div className={styles.inner}>
        <header className={styles.titleSection}>
          <EntryFormTitle titleLines={ENTRY_TITLE_LINES} visibleChars={visibleChars} />
        </header>

        <div className={styles.entryContentPanel}>
          <div className={styles.introBlock}>
            <h2 className={styles.sectionHeading}>
              <span className={styles.sectionHeadingText}>ご出欠について</span>
            </h2>
            <p className={styles.introText}>
              お手数ではございますが
              <br />
              下記お日にち迄に
              <br />
              出欠のご回答をくださいますよう
              <br />
              お願い申し上げます
            </p>
            <p className={styles.deadline}>
              <span className={styles.deadlineLabel}>ご回答期限</span>
              <span className={styles.deadlineDate}>{responseDeadline}</span>
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldsetBox}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.legendText}>ゲスト様入力項目</span>
              </legend>

            <div className={styles.field}>
              <span className={styles.labelText}>どちらのゲスト様ですか</span>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input type="radio" name="guestSide" value="groom" required />
                  新郎ゲスト
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="guestSide" value="bride" />
                  新婦ゲスト
                </label>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="relation">ご関係（新郎新婦から見た）</label>
              <select id="relation" name="relation" required>
                <option value="">選択してください</option>
                <option value="親族">親族</option>
                <option value="友人">友人</option>
                <option value="学校">学校</option>
                <option value="会社">会社</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="relationship">間柄（新郎新婦から見た）</label>
              <select id="relationship" name="relationship" required defaultValue="">
                <option value="">選択してください</option>
                {RELATIONSHIP_OPTIONS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="guestName">お名前</label>
              <input id="guestName" name="guestName" type="text" autoComplete="name" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="guestNameKana">フリガナ</label>
              <input id="guestNameKana" name="guestNameKana" type="text" autoComplete="off" required />
            </div>
            <div className={styles.field}>
              <span className={styles.labelText}>性別</span>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input type="radio" name="gender" value="male" required />
                  男性
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="gender" value="female" />
                  女性
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="gender" value="other" />
                  その他
                </label>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="postalCode">郵便番号</label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                inputMode="numeric"
                placeholder="例：123-4567"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="address">ご住所</label>
              <textarea id="address" name="address" rows={2} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="email">メールアドレス</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="allergy">アレルギーの有無、また種類</label>
              <textarea
                id="allergy"
                name="allergy"
                rows={3}
                placeholder="なしの場合は「なし」とご記入ください"
                required
              />
            </div>
            </fieldset>
          </div>

          <div className={styles.fieldsetBox}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.legendText}>アンケートへのご協力のお願い</span>
              </legend>
            <p className={styles.surveyIntro}>
              お手数ではございますが
              <br />
              アンケートをご用意いたしましたので
              <br />
              ご回答をよろしくお願いいたします
            </p>

            <div className={styles.field}>
              <label htmlFor="transport">交通手段</label>
              <select id="transport" name="transport" defaultValue="" required>
                <option value="">選択してください</option>
                <option value="train">電車</option>
                <option value="car">お車</option>
                <option value="taxi">タクシー</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.labelText}>電車の場合　徒歩かタクシーのご希望</span>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input type="radio" name="trainTransfer" value="walk" required />
                  徒歩
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="trainTransfer" value="taxi" />
                  タクシー
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="trainTransfer" value="na" />
                  該当なし
                </label>
              </div>
            </div>
            <div className={styles.field}>
              <span className={styles.labelText}>お子様の有無</span>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="hasChildren"
                    value="yes"
                    required
                    checked={hasChildrenChoice === 'yes'}
                    onChange={() => setHasChildrenChoice('yes')}
                  />
                  あり
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="hasChildren"
                    value="no"
                    checked={hasChildrenChoice === 'no'}
                    onChange={() => setHasChildrenChoice('no')}
                  />
                  なし
                </label>
              </div>
            </div>
            {hasChildrenChoice === 'yes' && (
              <div className={styles.field}>
                <label htmlFor="childrenCount">お子様の人数</label>
                <input
                  id="childrenCount"
                  name="childrenCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  step={1}
                  required
                  placeholder="例：1"
                />
              </div>
            )}
            {hasChildrenChoice === 'no' && <input type="hidden" name="childrenCount" value="" />}
            <div className={styles.field}>
              <span className={styles.labelText}>夫婦参加の場合　連名の有無</span>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input type="radio" name="jointName" value="yes" required />
                  あり
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="jointName" value="no" />
                  なし
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="jointName" value="na" />
                  該当なし
                </label>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="message">新郎新婦へメッセージ</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                placeholder="お祝いのメッセージなど"
                required
              />
            </div>
            <div className={styles.field}>
              <div className={styles.photoUploadCard}>
                <div className={styles.photoUploadCardTitle}>メッセージ画像登録</div>
                <div
                  className={`${styles.photoPreviewArea} ${imageItems.length > 0 ? styles.photoPreviewAreaHasImages : ''}`}
                  onClick={imageItems.length === 0 ? handlePhotoChangeClick : undefined}
                  role={imageItems.length === 0 ? 'button' : undefined}
                  tabIndex={imageItems.length === 0 ? 0 : undefined}
                  onKeyDown={
                    imageItems.length === 0
                      ? (ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            handlePhotoChangeClick()
                          }
                        }
                      : undefined
                  }
                  aria-label={imageItems.length === 0 ? '画像を選択' : undefined}
                >
                  {imageItems.length > 0 ? (
                    <div className={styles.photoPreviewGrid}>
                      {imageItems.map((item) => (
                        <div key={item.id} className={styles.photoPreviewThumb}>
                          <img src={item.previewUrl} alt="" className={styles.photoPreviewThumbImg} />
                          <button
                            type="button"
                            className={styles.photoThumbRemove}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              removeImageItem(item.id)
                            }}
                            aria-label="この画像を削除"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.photoThumbPlaceholder} aria-hidden="true">
                      <svg
                        className={styles.photoThumbPlaceholderSvg}
                        viewBox="0 0 120 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect x="4" y="12" width="112" height="76" rx="8" stroke="currentColor" strokeWidth="2.5" />
                        <path
                          d="M4 72 L32 44 L52 64 L76 36 L116 76"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="86" cy="32" r="8" stroke="currentColor" strokeWidth="2.5" />
                      </svg>
                      <span className={styles.photoThumbHint}>タップして選択（複数可）</span>
                    </div>
                  )}
                  <div className={styles.photoPreviewActions}>
                    <button
                      type="button"
                      className={styles.photoActionBtn}
                      disabled={imageItems.length >= MAX_RSVP_PHOTOS}
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePhotoChangeClick()
                      }}
                      aria-label="画像を追加"
                    >
                      <svg className={styles.photoActionIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M23 4v6h-6M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      追加
                    </button>
                    <button
                      type="button"
                      className={styles.photoActionBtn}
                      disabled={imageItems.length === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePhotoRemoveAll()
                      }}
                      aria-label="画像をすべて削除"
                    >
                      <svg className={styles.photoActionIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                      すべて削除
                    </button>
                  </div>
                </div>
                <p className={styles.photoUploadHint}>
                  画像は最大{MAX_RSVP_PHOTOS}枚・各15MBまで。複数枚はスプレッドシートに改行区切りのURLで保存されます。
                </p>
              </div>
              <input
                ref={photoInputRef}
                id="photo"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className={styles.photoInputHidden}
                aria-label="メッセージ画像をアップロード"
              />
            </div>
            </fieldset>
          </div>

          <div className={styles.fieldsetBox}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.legendText}>挙式・披露宴</span>
              </legend>
            <div
              className={styles.attendanceRadioInputs}
              role="radiogroup"
              aria-label="ご出席・ご欠席の選択"
            >
              <label className={styles.attendanceRadio}>
                <input
                  type="radio"
                  name="attendance"
                  value="attend"
                  required
                  className={styles.attendanceRadioInput}
                />
                <span className={styles.attendanceRadioName}>
                  <span className={styles.attendanceRadioNameInner}>ご出席</span>
                </span>
              </label>
              <label className={styles.attendanceRadio}>
                <input
                  type="radio"
                  name="attendance"
                  value="absent"
                  className={styles.attendanceRadioInput}
                />
                <span className={styles.attendanceRadioName}>
                  <span className={styles.attendanceRadioNameInner}>ご欠席</span>
                </span>
              </label>
            </div>
            </fieldset>
          </div>

          <div className={styles.submitWrap}>
            {submitStatus === 'ok' && submitOutcome === 'attend' && (
              <p className={styles.submitMessage} role="status">
                ご出席とのご回答をいただき、ありがとうございます。
                <br />
                当日お会いできることを心よりうれしく思っております。お待ちしております。
              </p>
            )}
            {submitStatus === 'ok' && submitOutcome === 'absent' && (
              <p className={styles.submitMessage} role="status">
                ご回答ありがとうございました。
              </p>
            )}
            {submitStatus === 'ok' && !submitOutcome && (
              <p className={styles.submitMessage} role="status">
                送信が完了しました。ご協力ありがとうございます。
              </p>
            )}
            {submitStatus === 'error' && submitError && (
              <p className={styles.submitError} role="alert">
                {submitError}
              </p>
            )}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitStatus === 'sending'}
            >
              {submitStatus === 'sending' ? '送信中…' : '送信'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </section>
  )
}
