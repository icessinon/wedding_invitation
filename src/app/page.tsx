import { Suspense } from 'react'
import { FirstView } from '../components/firstView'
import { CountDown } from '../components/countDown'
import { Message } from '../components/message'
import { Profile } from '../components/profile'
import { Album } from '../components/album'
import { PartyInfo } from '../components/partyInfo'
import { Other } from '../components/other'
import { ThankYouClose } from '../components/thankYouClose'

export default function Home() {
  return (
    <div className="min-h-screen border-0 outline-none">
      <FirstView
        weddingDate="2026年7月18日（土）"
        weddingDateTime="2026-07-18"
      />
      <CountDown />
      <Message />
      <Profile />
      <Album />
      <Suspense fallback={null}>
        <PartyInfo
          ceremonyStartTime="15:00"
          receptionStaffTime="14:00"
          receptionFamilyTime="14:15"
          receptionGuestTime="14:40"
          closingTime="18:30"
        />
      </Suspense>
      <Suspense fallback={null}>
        <Other />
      </Suspense>
      <ThankYouClose />
    </div>
  )
}
