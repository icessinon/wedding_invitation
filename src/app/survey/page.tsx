import type { Metadata } from 'next'
import { TravelSurvey } from '../../components/travelSurvey'
import styles from './survey.module.css'

export const metadata: Metadata = {
  title: '旅行アンケート | Wedding Thanks',
  description: 'みんなで行く旅行の行き先と行ける月のアンケートです。回答するとその場で結果に反映されます。',
}

export default function SurveyPage() {
  return (
    <div className={styles.page}>
      <TravelSurvey />
    </div>
  )
}
