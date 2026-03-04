'use client'

import { useEffect, useRef, useState } from 'react'
import type { CustomSelectProps } from './types'
import styles from './CustomSelect.module.css'

export default function CustomSelect(props: CustomSelectProps) {
    const {
        value,
        onChange,
        options,
        className = '',
        triggerClassName = '',
        disabled = false,
        placeholder = '選択してください',
        'aria-label': ariaLabel = '選択',
        searchable = true,
        searchPlaceholder = '検索...',
    } = props
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const selectedOption = options.find((o) => o.value === value)
    const displayLabel = selectedOption?.label ?? placeholder

    const filteredOptions = searchQuery.trim()
        ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        : options

    useEffect(() => {
        if (!open) {
            setSearchQuery('')
            return
        }
        if (searchable) {
            searchInputRef.current?.focus()
        }
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open, searchable])

    const handleSelect = (optionValue: string) => {
        onChange(optionValue)
        setOpen(false)
    }

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false)
        }
        e.stopPropagation()
    }

    return (
        <div ref={containerRef} className={`${styles.root} ${className}`.trim()}>
            <button
                type="button"
                className={`${styles.trigger} ${triggerClassName}`.trim()}
                onClick={() => !disabled && setOpen((o) => !o)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <span className={styles.value}>{displayLabel}</span>
                <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`} aria-hidden>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
                        <path fill="currentColor" d="M4 2 L8 6 L4 10" />
                    </svg>
                </span>
            </button>
            {open && (
                <div className={styles.dropdown} role="listbox" aria-activedescendant={value ? `option-${value}` : undefined}>
                    {searchable && (
                        <div className={styles.searchWrap} onClick={(e) => e.stopPropagation()}>
                            <span className={styles.searchIcon} aria-hidden>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
                            </span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder={searchPlaceholder}
                                aria-label="オプションを検索"
                                autoComplete="off"
                            />
                        </div>
                    )}
                    <div className={styles.optionsList}>
                        {filteredOptions.length === 0 ? (
                            <div className={styles.emptyOption}>該当なし</div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    id={`option-${opt.value}`}
                                    aria-selected={opt.value === value}
                                    className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''}`}
                                    onClick={() => handleSelect(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
