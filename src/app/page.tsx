import { FirstView } from '../components/firstView'
import { CountDown } from '../components/countDown'
import { Message } from '../components/message'
import { Profile } from '../components/profile'
import { Album } from '../components/album'
import { PartyInfo } from '../components/partyInfo'
import { Other } from '../components/other'
import { EntryForm } from '../components/entryForm'

export default function Home() {
  return (
    <div className="min-h-screen border-0 outline-none">
      <div className="pageSnapSection">
        <FirstView
          weddingDate="2026年7月18日（土）"
          weddingDateTime="2026-07-18"
        />
      </div>
      <div className="pageSnapSection">
        <CountDown />
      </div>
      <div className="pageSnapSection">
        <Message />
      </div>
      <div className="pageSnapSection">
        <Profile />
      </div>
      <div className="pageSnapSection">
        <Album />
      </div>
      <div className="pageSnapSection">
        <PartyInfo
          ceremonyStartTime="15:00"
          receptionStaffTime="14:00"
          receptionFamilyTime="14:20"
          receptionGuestTime="14:40"
          closingTime="18:30"
        />
      </div>
      <div className="pageSnapSection">
        <Other />
      </div>
      <div className="pageSnapSectionLong">
        <EntryForm responseDeadline="2026年6月18日" />
      </div>
    </div>
  )
}
