/**
 * Google Drive 用 OAuth リフレッシュトークンを取得する（1回だけ実行）
 *
 * 事前: GCP の OAuth 2.0 クライアントに「承認済みのリダイレクト URI」として、
 *       起動時に表示される URL を 1 文字も違えず追加する（127.0.0.1 と localhost は別物）
 *
 * 任意 .env:
 *   GOOGLE_DRIVE_OAUTH_REDIRECT_URI=http://localhost:8765/oauth2callback
 *   （未設定なら http://127.0.0.1:8765/oauth2callback）
 *
 * 実行: npm run oauth:drive
 */
import http from 'node:http'
import { google } from 'googleapis'

const PORT = Number(process.env.OAUTH_DRIVE_PORT || 8765) || 8765
const REDIRECT_PATH = '/oauth2callback'

const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim()
const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim()

const redirectUriOverride = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim()
const redirectUri =
  redirectUriOverride ||
  `http://127.0.0.1:${PORT}${REDIRECT_PATH}`

if (!clientId || !clientSecret || clientSecret === '...') {
  console.error(
    'GOOGLE_DRIVE_OAUTH_CLIENT_ID と GOOGLE_DRIVE_OAUTH_CLIENT_SECRET を .env に設定してください（SECRET の ... を実値に）。'
  )
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
})

const server = http.createServer(async (req, res) => {
  const urlPath = req.url?.split('?')[0] ?? ''
  if (urlPath !== REDIRECT_PATH) {
    res.writeHead(404)
    res.end()
    return
  }

  const url = new URL(req.url ?? '', redirectUri)
  const err = url.searchParams.get('error')
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<p>エラー: ${err}</p>`)
    console.error('OAuth error:', err)
    server.close()
    process.exit(1)
    return
  }

  const code = url.searchParams.get('code')
  if (!code) {
    res.writeHead(400)
    res.end('code がありません')
    server.close()
    process.exit(1)
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    if (!tokens.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<p>refresh_token が返りませんでした。初回同意のため「アクセスのブロックを解除」や別アカウントを試すか、もう一度実行してください。</p>'
      )
      console.error('No refresh_token. Try revoking app access at https://myaccount.google.com/permissions and run again.')
      server.close()
      process.exit(1)
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<p>取得できました。このタブを閉じてターミナルの表示を .env にコピーしてください。</p>')

    console.log('\n--- 次の1行を .env の GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN に貼り付け ---\n')
    console.log(`GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`)
    server.close()
    process.exit(0)
  } catch (e) {
    console.error(e)
    res.writeHead(500)
    res.end('token 交換に失敗')
    server.close()
    process.exit(1)
  }
})

server.listen(PORT, () => {
  console.log('\n========== redirect_uri_mismatch を防ぐ ==========')
  console.log('Google Cloud Console → API とサービス → 認証情報 → 使用中の OAuth 2.0 クライアント')
  console.log('種別が「ウェブアプリケーション」でも「デスクトップ」でも、次の URI を')
  console.log('「承認済みのリダイレクト URI」にコピペして保存してください（末尾スラッシュなし）:\n')
  console.log(`   ${redirectUri}\n`)
  if (!redirectUriOverride) {
    console.log('※ GCP に http://localhost:... だけ登録している場合は .env に次を追加:')
    console.log(`   GOOGLE_DRIVE_OAUTH_REDIRECT_URI=http://localhost:${PORT}${REDIRECT_PATH}\n`)
  }
  console.log('参考: https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch')
  console.log('403 access_denied（テスト中のアプリ）→ Cloud Console の「OAuth 同意画面」で「テストユーザー」に、')
  console.log('  許可に使う Google アカウントのメールを追加してください。docs/SPREADSHEET_SETUP.md も参照。\n')
  console.log('====================================================\n')
  console.log('ブラウザで次を開いて許可:\n')
  console.log(authUrl + '\n')
})
