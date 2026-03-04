export interface CustomSelectOption {
    value: string
    label: string
}

export interface CustomSelectProps {
    value: string
    onChange: (value: string) => void
    options: CustomSelectOption[]
    className?: string
    triggerClassName?: string
    disabled?: boolean
    placeholder?: string
    'aria-label'?: string
    /** ドロップダウン内で検索可能にする（デフォルト: true） */
    searchable?: boolean
    /** 検索入力のプレースホルダー */
    searchPlaceholder?: string
}
