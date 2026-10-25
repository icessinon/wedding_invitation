import type { Metadata } from 'next'
import { TravelSchedule } from '../../components/travelSchedule'
import styles from './schedule.module.css'

export const metadata: Metadata = {
  title: '旅行の日程アンケート | Wedding Thanks',
  description: '月ごとの旅行候補と、カレンダーで行ける日を選ぶ日程調整のページです。',
}

export default function SchedulePage() {
  return (
    <div className={styles.page}>
      <TravelSchedule />
    </div>
  )
}
