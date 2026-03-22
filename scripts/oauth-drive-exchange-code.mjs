/**
 * ブラウザが開いたコールバック URL に含まれる ?code=... をトークンに交換する
 * （npm run oauth:drive のサーバーが動いていなかったとき用）
 *
 * 使い方:
 *   npm run oauth:drive:exchange -- "4/0Axxxx..."
 * またはコールバック URL 全体:
 *   npm run oauth:drive:exchange -- "http://127.0.0.1:8765/oauth2callback?code=4/0A..."
 *
 * code は数分で失効します。ダメなら npm run oauth:drive をやり直してください。
 */
import { google } from 'googleapis'

const raw = process.argv.slice(2).join(' ').trim()
if (!raw) {
  console.error('使い方: npm run oauth:drive:exchange -- "認可コードまたはコールバックURL全体"')
  process.exit(1)
}

let code = raw
try {
  if (raw.includes('code=')) {
    const u = new URL(raw.startsWith('http') ? raw : `http://dummy${raw}`)
    const c = u.searchParams.get('code')
    if (c) code = c
  }
} catch {
  /* raw が素の code */
}

const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim()
const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim()
const redirectUri =
  process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim() ||
  `http://127.0.0.1:${Number(process.env.OAUTH_DRIVE_PORT || 8765) || 8765}/oauth2callback`

if (!clientId || !clientSecret) {
  console.error('.env に GOOGLE_DRIVE_OAUTH_CLIENT_ID / CLIENT_SECRET が必要です')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

try {
  const { tokens } = await oauth2Client.getToken(code)
  if (!tokens.refresh_token) {
    console.error(
      'refresh_token が返りませんでした。初回同意には prompt=consent が必要です。npm run oauth:drive を実行し直してください。'
    )
    if (tokens.access_token) console.error('（access_token はありますがサーバー用には refresh が必要です）')
    process.exit(1)
  }
  console.log('\n--- .env に貼り付け ---\n')
  console.log(`GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`)
} catch (e) {
  console.error('交換に失敗:', e.message || e)
  console.error('\nredirect_uri が npm run oauth:drive 実行時と同じか確認してください（GOOGLE_DRIVE_OAUTH_REDIRECT_URI）')
  process.exit(1)
}
