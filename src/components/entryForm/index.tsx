'use client'

import React, { useState, useEffect, useRef } from 'react'
import styles from './entryForm.module.css'
import type { EntryFormProps } from './types'
import { useTitleAnimation } from '../album/hooks/useTitleAnimation'
import { EntryFormTitle } from './EntryFormTitle'

const ENTRY_TITLE_LINES = ['PRESENCE', 'OR', 'ABSENCE']
const ENTRY_TITLE_TEXT = ENTRY_TITLE_LINES.join('')

export const EntryForm: React.FC<EntryFormProps> = ({
  responseDeadline = '2026年○月○日',
  spreadsheetWebAppUrl,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const visibleChars = useTitleAnimation(containerRef, ENTRY_TITLE_TEXT)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    if (!file) {
      setImagePreview(null)
      return
    }
    setImagePreview(URL.createObjectURL(file))
  }

  const handlePhotoChangeClick = () => {
    photoInputRef.current?.click()
  }

  const handlePhotoRemove = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const data: Record<string, string> = {}
    formData.forEach((value, key) => {
      if (key === 'photo' && value instanceof File) {
        data[key] = value.name ? `（画像: ${value.name}）` : ''
        return
      }
      data[key] = String(value)
    })

    if (spreadsheetWebAppUrl) {
      setSubmitStatus('sending')
      try {
        await fetch(spreadsheetWebAppUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        setSubmitStatus('ok')
        form.reset()
        setImagePreview(null)
      } catch (err) {
        setSubmitStatus('error')
        setSubmitError(err instanceof Error ? err.message : '送信に失敗しました')
      }
    } else {
      setSubmitError('スプレッドシート連携のURLが設定されていません。')
      setSubmitStatus('error')
    }
  }

  return (
    <section ref={containerRef} className={styles.container} id="entry">
      <div className={styles.inner}>
        <header className={styles.titleSection}>
          <EntryFormTitle titleLines={ENTRY_TITLE_LINES} visibleChars={visibleChars} />
        </header>

        <div className={styles.entryContentPanel}>
          <div className={styles.introBlock}>
            <h2 className={styles.sectionHeading}>ご出欠について</h2>
            <p className={styles.introText}>
              お手数ではございますが
              <br />
              下記お日にち迄に
              <br />
              出欠のご回答をくださいますよう
              <br />
              お願い申し上げます
            </p>
            <p className={styles.introText}>
              また　期日までのご回答が難しい場合は
              <br />
              一度保留でのご回答をお願いいたします
            </p>
            <p className={styles.deadline}>
              <span className={styles.deadlineLabel}>ご回答期限</span>
              <span className={styles.deadlineDate}>{responseDeadline}</span>
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldsetBox}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>ゲスト様</legend>

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
              <input id="relationship" name="relationship" type="text" autoComplete="off" required />
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
              <legend className={styles.legend}>アンケートへのご協力のお願い</legend>
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
                  <input type="radio" name="hasChildren" value="yes" required />
                  あり
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="hasChildren" value="no" />
                  なし
                </label>
              </div>
            </div>
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
                  className={styles.photoPreviewArea}
                  onClick={!imagePreview ? handlePhotoChangeClick : undefined}
                  role={!imagePreview ? 'button' : undefined}
                  tabIndex={!imagePreview ? 0 : undefined}
                  onKeyDown={!imagePreview ? (ev) => ev.key === 'Enter' && handlePhotoChangeClick() : undefined}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="プレビュー" className={styles.photoPreviewImg} />
                      <div className={styles.photoPreviewActions}>
                        <button type="button" className={styles.photoActionBtn} onClick={handlePhotoChangeClick} aria-label="画像を変更">
                          <svg className={styles.photoActionIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M23 4v6h-6M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                          変更
                        </button>
                        <button type="button" className={styles.photoActionBtn} onClick={handlePhotoRemove} aria-label="画像を削除">
                          <svg className={styles.photoActionIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          削除
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className={styles.photoPlaceholder}>画像を選択</span>
                  )}
                </div>
                <p className={styles.photoUploadHint}>お祝いメッセージ等を自由にご記入ください</p>
              </div>
              <input
                ref={photoInputRef}
                id="photo"
                name="photo"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className={styles.photoInputHidden}
                aria-label="メッセージ画像をアップロード"
              />
            </div>
            </fieldset>
          </div>

          <div className={styles.fieldsetBox}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>挙式・披露宴</legend>
            <div
              className={styles.attendanceRadioInputs}
              role="radiogroup"
              aria-label="ご出席・ご欠席・保留の選択"
            >
              <label className={styles.attendanceRadio}>
                <input
                  type="radio"
                  name="attendance"
                  value="attend"
                  required
                  className={styles.attendanceRadioInput}
                />
                <span className={styles.attendanceRadioName}>ご出席</span>
              </label>
              <label className={styles.attendanceRadio}>
                <input
                  type="radio"
                  name="attendance"
                  value="absent"
                  className={styles.attendanceRadioInput}
                />
                <span className={styles.attendanceRadioName}>ご欠席</span>
              </label>
              <label className={styles.attendanceRadio}>
                <input
                  type="radio"
                  name="attendance"
                  value="pending"
                  className={styles.attendanceRadioInput}
                />
                <span className={styles.attendanceRadioName}>保留</span>
              </label>
            </div>
            </fieldset>
          </div>

          <div className={styles.submitWrap}>
            {submitStatus === 'ok' && (
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
