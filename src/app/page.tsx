import { FirstView } from '../components/firstView'
import { ThanksMessage } from '../components/thanksMessage'
import { EndRoll } from '../components/endRoll'
import { OceanMemories } from '../components/oceanMemories'
import { PhotoCta } from '../components/photoCta'
import { ThankYouClose } from '../components/thankYouClose'

// 結婚式後の Thank You バージョン。
// 招待状時代のセクション（カウントダウン・プロフィール・アルバム・
// パーティー情報・回答フォーム等）はコンポーネントとして残しつつ非表示。
export default function Home() {
  return (
    <div className="min-h-screen border-0 outline-none">
      <FirstView
        titleLines={['Thank', 'You']}
        weddingDate="2026年7月18日（土）"
        weddingDateTime="2026-07-18"
        dateLabel="挙式の日"
      />
      <ThanksMessage />
      <EndRoll />
      <OceanMemories />
      <PhotoCta />
      <ThankYouClose />
    </div>
  )
}
