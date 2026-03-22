export interface FirstViewProps {
  /** 表示用の挙式日（例: 2026年7月18日（土）） */
  weddingDate?: string
  /** `<time dateTime>` 用（例: 2026-07-18） */
  weddingDateTime?: string
  /** 日付の上の短いラベル */
  dateLabel?: string
}
