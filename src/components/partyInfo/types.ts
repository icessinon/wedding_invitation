export interface PartyInfoProps {
  date?: string; // YYYY/MM/DD ddd形式
  ceremonyStartTime?: string; // HH:MM形式
  receptionStaffTime?: string; // HH:MM形式
  receptionFamilyTime?: string; // HH:MM形式
  receptionGuestTime?: string; // HH:MM形式
  closingTime?: string; // HH:MM形式
  venueName?: string;
  venueAddress?: string;
  venuePhone?: string;
  /** Google Maps の「共有 > 地図を埋め込む」で取得した iframe の src の URL。未指定の場合は「地図を見る」リンクのみ表示 */
  venueEmbedUrl?: string;
}

