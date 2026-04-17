'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import styles from './entryForm.module.css'
import type { EntryFormProps } from './types'
import { RELATIONSHIP_OPTIONS } from './relationshipOptions'
import { useTitleAnimation } from '../../hooks/useTitleAnimation'
import { EntryFormTitle } from './EntryFormTitle'
import {
  ENVELOPE_OPEN_HINT_FIXED,
  parseLetterUrlHints,
  resolveLetterBody,
  type LetterUrlHints,
} from './envelopeOpenHint'

const ENTRY_TITLE_LINES = ['PRESENCE', 'OR', 'ABSENCE']
const ENTRY_TITLE_TEXT = ENTRY_TITLE_LINES.join('')

const MAX_RSVP_PHOTOS = 10
const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const MAX_JOINT_PARTNER_NAMES = 10
const MAX_JOINT_PARTNER_NAME_LEN = 80

type ImageItem = { id: string; file: File; previewUrl: string }

function newImageItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const BUBBLE_SEA_COUNT = 240

const RSVP_DRY_RUN = process.env.NEXT_PUBLIC_RSVP_DRY_RUN === 'true'

async function compressImage(file: File, maxSidePx = 1920, quality = 0.82): Promise<File> {
  if (file.size < 500 * 1024) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSidePx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function letterTextToNodes(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </React.Fragment>
  ))
}

export const EntryForm: React.FC<EntryFormProps> = ({ responseDeadline = '2026年○月○日' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const visibleChars = useTitleAnimation(containerRef, ENTRY_TITLE_TEXT)
  const [imageItems, setImageItems] = useState<ImageItem[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [hasChildrenChoice, setHasChildrenChoice] = useState<'yes' | 'no' | ''>('')
  const [fieldErrors, setFieldErrors] = useState<{ guestNameKana?: string }>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOutcome, setSubmitOutcome] = useState<'attend' | 'absent' | null>(null)
  const [letterModalOpen, setLetterModalOpen] = useState(false)
  const [letterPulledOut, setLetterPulledOut] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const letterCloseRef = useRef<HTMLButtonElement>(null)
  const letterRevealRef = useRef<HTMLButtonElement>(null)
  const letterSendingRef = useRef<HTMLDivElement>(null)
  const wasSuccessfulRef = useRef(false)

  const [letterUrlHints, setLetterUrlHints] = useState<LetterUrlHints>({
    urlAttend: false,
    letterCode: null,
    urlLetter: null,
    urlLetterAttend: null,
    urlLetterAbsent: null,
  })

  useEffect(() => {
    setLetterUrlHints(parseLetterUrlHints(window.location.search))
  }, [])


  const letterBodyCustom = useMemo(
    () => resolveLetterBody(submitOutcome, submitStatus, letterUrlHints),
    [submitOutcome, submitStatus, letterUrlHints]
  )

  const [jointNameChoice, setJointNameChoice] = useState<'yes' | 'no' | ''>('')
  const [jointPartnerRows, setJointPartnerRows] = useState<string[]>([])

  const imageItemsRef = useRef(imageItems)
  imageItemsRef.current = imageItems

  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!letterModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [letterModalOpen])

  useEffect(() => {
    if (letterModalOpen) setLetterPulledOut(false)
  }, [letterModalOpen])

  useEffect(() => {
    if (!letterModalOpen || submitStatus === 'sending') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLetterModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [letterModalOpen, submitStatus])

  useEffect(() => {
    if (!letterModalOpen) return
    if (submitStatus === 'sending') {
      letterSendingRef.current?.focus()
      return
    }
    if (!letterPulledOut) {
      letterRevealRef.current?.focus()
      return
    }
    letterCloseRef.current?.focus()
  }, [letterModalOpen, letterPulledOut, submitStatus])

  const isLikelyImageName = (name: string) => /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(name)

  const appendImageFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    let rejectedReason: string | null = null
    setImageItems((prev) => {
      const next = [...prev]
      for (const file of list) {
        if (next.length >= MAX_RSVP_PHOTOS) {
          rejectedReason = `画像は最大${MAX_RSVP_PHOTOS}枚までです`
          break
        }
        const isImage = file.type.startsWith('image/') || (!file.type && isLikelyImageName(file.name))
        if (!isImage) {
          rejectedReason = '画像ファイルのみ追加できます'
          continue
        }
        if (file.size > MAX_PHOTO_BYTES) {
          rejectedReason = '画像は1枚あたり15MB以下にしてください'
          continue
        }
        next.push({ id: newImageItemId(), file, previewUrl: URL.createObjectURL(file) })
      }
      return next
    })
    setPhotoError(rejectedReason)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    appendImageFiles(list)
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
    setPhotoError(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function closeLetterModal() {
    if (wasSuccessfulRef.current) {
      sessionStorage.setItem('rsvp_done', '1')
      window.dispatchEvent(new CustomEvent('rsvp-done'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setLetterModalOpen(false)
    setLetterPulledOut(false)
    setSubmitStatus('idle')
    setSubmitError(null)
    setSubmitOutcome(null)
    setJointNameChoice('')
    setJointPartnerRows([])
  }

  const validateGuestNameKana = (value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed) return 'フリガナを入力してください'
    const kanaRe = /^[ァ-ンヴー\s　]+$/
    if (!kanaRe.test(trimmed)) return 'フリガナは全角カタカナでご入力ください'
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitOutcome(null)

    const form = e.currentTarget
    const guestNameKana = (form.guestNameKana as HTMLInputElement | undefined)?.value ?? ''

    if (!RSVP_DRY_RUN) {
      const kanaError = validateGuestNameKana(guestNameKana)

      const requiredFields = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input[required], select[required], textarea[required]'
        )
      )
      let firstInvalid: HTMLElement | null = null
      for (const field of requiredFields) {
        if (!field.checkValidity() || (field.id === 'guestNameKana' && !!kanaError)) {
          firstInvalid = field
          break
        }
      }
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
        firstInvalid.focus()
        if (kanaError) setFieldErrors((prev) => ({ ...prev, guestNameKana: kanaError }))
        return
      }
    }
    setFieldErrors((prev) => ({ ...prev, guestNameKana: undefined }))

    const formData = new FormData(form)
    const jointNameVal = String(formData.get('jointName') ?? '')
    if (jointNameVal === 'yes') {
      const parts = jointPartnerRows.map((s) => s.trim()).filter(Boolean)
      if (!RSVP_DRY_RUN && parts.length === 0) {
        setSubmitError('連名ありの場合は、連名の方のお名前を1名以上入力してください')
        return
      }
      parts.forEach((p) => formData.append('jointPartnerName', p))
    }
    for (const item of imageItems) {
      const compressed = await compressImage(item.file)
      formData.append('photo', compressed)
    }
    const attendance = String(formData.get('attendance') ?? '')
    setSubmitStatus('sending')
    setLetterModalOpen(true)
    try {
      if (RSVP_DRY_RUN) {
        await new Promise((r) => setTimeout(r, 1600))
      } else {
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
      }
      if (attendance === 'attend' || attendance === 'absent') {
        setSubmitOutcome(attendance)
      }
      wasSuccessfulRef.current = true
      setFormSubmitted(true)
      setSubmitStatus('ok')
      setHasChildrenChoice('')
      setJointNameChoice('')
      setJointPartnerRows([])
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

  const letterSheetTitle =
    submitStatus === 'error' ? '送信できませんでした' : '回答ありがとうございます'

  const successMessageDefault =
    submitOutcome === 'absent' ? (
      <>
        ご連絡いただきありがとうございます。
        <br />
        当日お会いできないのはとても残念ですが、
        <br />
        温かいお気持ちだけでもとても嬉しいです。
        <br />
        またいつかゆっくり
        <br />
        お話しできる日を楽しみにしています。
      </>
    ) : (
      <>
        このたびは私たちの結婚式に際し
        <br />
        ご多用中のところご出席のお返事賜りまして
        <br />
        誠にありがとうございます。
        <br />
        当日にお会いできるのを
        <br />
        心待ちにしております♪
      </>
    )

  const successMessage =
    letterBodyCustom != null ? letterTextToNodes(letterBodyCustom) : successMessageDefault

  const letterModal = letterModalOpen ? (
      <div className={styles.letterOverlayRoot}>
        <div
          className={styles.letterBackdrop}
          role="presentation"
          onClick={() => submitStatus !== 'sending' && closeLetterModal()}
        />
        <div
          className={styles.letterDialog}
          role="dialog"
          aria-modal="true"
          {...(submitStatus === 'sending'
            ? { 'aria-label': 'しばらくお待ちください' }
            : letterPulledOut
              ? { 'aria-labelledby': 'rsvp-letter-title' }
              : { 'aria-label': ENVELOPE_OPEN_HINT_FIXED })}
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className={`${styles.letterCard} ${submitStatus === 'sending' ? styles.letterCardSending : ''}`}>
            <div className={styles.envelopeStage} aria-hidden="true">
              <img
                src="/rsvp-envelope/before.png"
                alt=""
                className={styles.envelopeBefore}
                width={530}
                height={316}
                decoding="async"
              />
              <img
                src="/rsvp-envelope/after.png"
                alt=""
                className={styles.envelopeAfter}
                width={530}
                height={260}
                decoding="async"
              />
            </div>
            {submitStatus === 'sending' && (
              <div
                ref={letterSendingRef}
                id="rsvp-sending-panel"
                className={styles.letterSendingOverlay}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className={styles.rsvpLoadingContainer}>
                  <div className={styles.rsvpCubeLoader}>
                    <div className={styles.rsvpCube} />
                    <div className={styles.rsvpCube} />
                    <div className={styles.rsvpCube} />
                    <div className={styles.rsvpCube} />
                  </div>
                </div>
              </div>
            )}
            {submitStatus !== 'sending' && !letterPulledOut && (
              <>
                <div id="rsvp-letter-stub" className={styles.letterSheetStub} aria-hidden="true" />
                <p className={styles.letterOpenHint} aria-hidden="true">
                  {ENVELOPE_OPEN_HINT_FIXED}
                </p>
                <button
                  ref={letterRevealRef}
                  type="button"
                  className={styles.letterRevealHit}
                  aria-label={ENVELOPE_OPEN_HINT_FIXED}
                  aria-expanded={false}
                  aria-controls="rsvp-letter-stub"
                  onClick={() => setLetterPulledOut(true)}
                >
                </button>
              </>
            )}
            {submitStatus !== 'sending' && letterPulledOut && (
              <div
                id="rsvp-letter-sheet"
                tabIndex={-1}
                className={`${styles.letterSheet} ${styles.letterSheetRevealed}`}
              >
                <p id="rsvp-letter-title" className={styles.letterTitle}>
                  {letterSheetTitle}
                </p>
                <div key={`${submitStatus}-${submitOutcome ?? ''}`} className={styles.letterBody}>
                  {submitStatus === 'ok' && (
                    <p className={styles.letterMessage} role="status">
                      {successMessage}
                    </p>
                  )}
                  {submitStatus === 'error' && submitError && (
                    <p className={styles.letterError} role="alert">
                      {submitError}
                    </p>
                  )}
                  <button
                    ref={letterCloseRef}
                    type="button"
                    className={styles.letterCloseBtn}
                    onClick={closeLetterModal}
                  >
                    閉じる
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null

  return (
    <section ref={containerRef} className={styles.container} id="entry">
      <div className={styles.bubbleSea} aria-hidden="true">
        {Array.from({ length: BUBBLE_SEA_COUNT }, (_, i) => {
          const left = ((i * 43 + 17) % 89) + 5
          const size = 2 + (i % 5) + (i % 7 === 0 ? 1 : 0) + (i % 11 === 0 ? 1 : 0)
          const duration = 14 + ((i * 53 + (i % 13) * 37) % 296)
          const delay = -((i * 0.31) % 20)
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

          <form className={styles.form} onSubmit={handleSubmit} noValidate={RSVP_DRY_RUN}>
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
              <input
                id="guestNameKana"
                name="guestNameKana"
                type="text"
                autoComplete="off"
                required
                onBlur={(ev) => {
                  const err = validateGuestNameKana(ev.target.value)
                  setFieldErrors((prev) => ({ ...prev, guestNameKana: err || undefined }))
                }}
              />
              {fieldErrors.guestNameKana && (
                <p className={styles.fieldError}>{fieldErrors.guestNameKana}</p>
              )}
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
              <p className={styles.fieldNote}>
                ※可能な限りご対応をさせていただきますが、内容によってはご対応出来かねる場合がございます。
              </p>
              <p className={styles.fieldNote}>
                ※苦手食材のご対応はいたしかねますのでご了承ください。
              </p>
              <p className={styles.fieldNote}>
                ※式場よりゲスト様へ直接ご連絡させて頂く場合がございます。
              </p>
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
                  min={0}
                  max={20}
                  step={1}
                  required
                  defaultValue={0}
                  placeholder="0"
                />
              </div>
            )}
            {hasChildrenChoice === 'no' && <input type="hidden" name="childrenCount" value="" />}
            <div className={styles.field}>
              <span className={styles.labelText}>夫婦参加の場合　連名の有無</span>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="jointName"
                    value="yes"
                    required
                    checked={jointNameChoice === 'yes'}
                    onChange={() => {
                      setJointNameChoice('yes')
                      setJointPartnerRows((r) => (r.length > 0 ? r : ['']))
                    }}
                  />
                  あり
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="jointName"
                    value="no"
                    checked={jointNameChoice === 'no'}
                    onChange={() => {
                      setJointNameChoice('no')
                      setJointPartnerRows([])
                    }}
                  />
                  なし
                </label>
              </div>
            </div>
            {jointNameChoice === 'yes' && (
              <div className={styles.field}>
                <span className={styles.labelText}>連名の方のお名前</span>
                {jointPartnerRows.map((val, i) => (
                  <div key={i} className={styles.jointPartnerRow}>
                    <input
                      type="text"
                      className={styles.jointPartnerInput}
                      value={val}
                      onChange={(e) => {
                        const next = [...jointPartnerRows]
                        next[i] = e.target.value.slice(0, MAX_JOINT_PARTNER_NAME_LEN)
                        setJointPartnerRows(next)
                      }}
                      placeholder={i === 0 ? '例：山田 花子' : 'お名前をご入力ください'}
                      autoComplete="name"
                      aria-label={`連名 ${i + 1}人目`}
                    />
                    {jointPartnerRows.length > 1 && (
                      <button
                        type="button"
                        className={styles.jointPartnerRemoveBtn}
                        onClick={() => setJointPartnerRows(jointPartnerRows.filter((_, j) => j !== i))}
                        aria-label={`連名 ${i + 1}人目を削除`}
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
                {jointPartnerRows.length < MAX_JOINT_PARTNER_NAMES && (
                  <button
                    type="button"
                    className={styles.jointPartnerAddBtn}
                    onClick={() => setJointPartnerRows([...jointPartnerRows, ''])}
                  >
                    名前を追加
                  </button>
                )}
              </div>
            )}
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
                  className={`${styles.photoPreviewArea} ${imageItems.length >= 2 ? styles.photoPreviewAreaHasImages : ''}`}
                  onClick={imageItems.length === 0 ? handlePhotoChangeClick : undefined}
                  role={imageItems.length === 0 ? 'button' : undefined}
                  tabIndex={imageItems.length === 0 ? 0 : undefined}
                  onPaste={(ev) => {
                    const files = ev.clipboardData?.files
                    if (files?.length) {
                      ev.preventDefault()
                      appendImageFiles(files)
                    }
                  }}
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
                  {imageItems.length === 1 ? (
                    <div className={styles.photoPreviewSingleWrap}>
                      <img
                        src={imageItems[0].previewUrl}
                        alt="アップロードする画像のプレビュー"
                        className={styles.photoPreviewSingleImg}
                      />
                      <button
                        type="button"
                        className={styles.photoThumbRemove}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          removeImageItem(imageItems[0].id)
                        }}
                        aria-label="この画像を削除"
                      >
                        ×
                      </button>
                    </div>
                  ) : imageItems.length >= 2 ? (
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
                <p className={styles.photoUploadHint}>画像は最大{MAX_RSVP_PHOTOS}枚・各15MBまで。</p>
                {photoError && <p className={styles.photoUploadError}>{photoError}</p>}
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
            {RSVP_DRY_RUN && (
              <p className={styles.dryRunHint} role="note">
                テストモード（API は送信されません・未入力でも送信できます）
              </p>
            )}
            <button type="submit" className={styles.submitBtn} disabled={submitStatus === 'sending'}>
              {submitStatus === 'sending' ? '送信中…' : formSubmitted ? '送信されました' : '送信'}
            </button>
          </div>
        </form>
        </div>
      </div>
      {portalReady ? createPortal(letterModal, document.body) : null}
    </section>
  )
}
