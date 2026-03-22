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
      <FirstView
        weddingDate="2026年7月18日（土）"
        weddingDateTime="2026-07-18"
      />
      <CountDown />
      <Message />
      <Profile />
      <Album />
      <PartyInfo />
      <Other />
      <EntryForm responseDeadline="2026年○月○日" />
    </div>
  )
}
