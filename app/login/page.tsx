'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './LoginPage.module.css'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const from = searchParams.get('from') || '/'

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showTerminal, setShowTerminal] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'ログインに失敗しました')
                setLoading(false)
                return
            }

            setShowTerminal(true)
            setLoading(false)

            setTimeout(() => {
                router.push(from)
                router.refresh()
            }, 2200)
        } catch {
            setError('接続に失敗しました')
            setLoading(false)
        }
    }

    return (
        <div className={styles.wrapper}>
            {!showTerminal ? (
                <form className={styles.card} onSubmit={handleSubmit}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>
                            <img src="/icon.png" alt="" className={styles.cardTitleIcon} width={24} height={24} />
                            <span>SECURE_DATA</span>
                        </div>
                        <div className={styles.cardDots}>
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                    <div className={styles.cardBody}>
                        <div className={styles.formGroup}>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                required
                                placeholder=" "
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                            />
                            <label htmlFor="username" className={styles.formLabel} data-text="USERNAME">
                                USERNAME
                            </label>
                        </div>
                        <div className={styles.formGroup}>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                required
                                placeholder=" "
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <label htmlFor="password" className={styles.formLabel} data-text="ACCESS_KEY">
                                ACCESS_KEY
                            </label>
                        </div>
                        {error && <p className={styles.formError}>{error}</p>}
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={loading}
                            data-text="INITIATE_CONNECTION"
                        >
                            <span className={styles.btnText}>
                                {loading ? 'CHECKING...' : 'INITIATE_CONNECTION'}
                            </span>
                        </button>
                    </div>
                </form>
            ) : (
                <div className={styles.terminalWrapper}>
                    <div className={styles.terminalLoader}>
                        <div className={styles.terminalHeader}>
                            <span className={styles.terminalTitle}>Status</span>
                            <div className={styles.terminalControls}>
                                <span className={`${styles.control} ${styles.controlClose}`} />
                                <span className={`${styles.control} ${styles.controlMinimize}`} />
                                <span className={`${styles.control} ${styles.controlMaximize}`} />
                            </div>
                        </div>
                        <div className={styles.terminalText}>Loading...</div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className={styles.wrapper}>Loading...</div>}>
            <LoginForm />
        </Suspense>
    )
}
