# エントリーフォーム → Google スプレッドシート + Google Drive（画像）

フォーム送信は Next.js の **`POST /api/rsvp`** が受け取り、[Google Sheets API](https://developers.google.com/sheets/api) で回答を追記し、画像がある場合は [Google Drive API](https://developers.google.com/drive/api) で **`GOOGLE_DRIVE_RSVP_FOLDER_ID` のフォルダ直下に、フォームの「お名前」と同じ名前のサブフォルダを作成**（すでにあればそのフォルダを使う）し、その中に画像を保存します。スプレッドシートの `photo` 列には **その画像の閲覧用リンク** を書き込みます。GAS は使いません。

## 1. スプレッドシートを用意

[Google スプレッドシート](https://sheets.google.com) を作成し、URL の `https://docs.google.com/spreadsheets/d/【ここがID】/edit` から **スプレッドシート ID** を控えます。

## 2. サービスアカウントを作成

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを選択（または新規作成）
2. **API とサービス** → **ライブラリ** で **Google Sheets API** と **Google Drive API** を有効化
3. **IAM と管理** → **サービスアカウント** → アカウントを作成
4. 作成したサービスアカウントを開き、**キー** タブ → **鍵を追加** → **JSON** をダウンロード

## 3. スプレッドシートと Drive フォルダを共有

ダウンロードした JSON の `client_email`（例: `xxx@xxx.iam.gserviceaccount.com`）を、回答用の **スプレッドシート** に **編集者** で追加します。

### 画像保存まわり（重要）

**サービスアカウントにはマイドライブのストレージ容量がありません。** 次のどちらかが必要です（[共有ドライブの説明](https://developers.google.com/drive/api/guides/about-shareddrives)）。

#### 推奨 A: 共有ドライブ（Google Workspace など）+ サービスアカウント

1. [共有ドライブ](https://support.google.com/a/users/answer/9310351) を作成する（または既存の共有ドライブを使う）
2. 共有ドライブの **メンバー** に、サービスアカウントのメールを **コンテンツ管理者** または **投稿者** など、フォルダ作成・アップロードができる権限で追加する
3. その共有ドライブの中に **RSVP 用フォルダ** を作成し、フォルダ URL の ID を `GOOGLE_DRIVE_RSVP_FOLDER_ID` に設定する

※ 個人の「マイドライブ」直下だけにフォルダを置いて共有しても、上記の **容量エラー** が出ることがあります。**フォルダ本体が共有ドライブ上**にある必要があります。

#### 代替 B: OAuth（ユーザーの Drive に保存）

無料の `@gmail.com` だけで運用する場合は、**画像の保存先だけ** あなたの Google アカウント（OAuth）にし、スプレッドシートは従来どおりサービスアカウントで更新する構成にできます。

`.env` に次を追加します（[リフレッシュトークンの取得](https://developers.google.com/identity/protocols/oauth2#5.-refresh-the-access-token,-if-needed) は別途 1 回だけ実施）。

```bash
GOOGLE_DRIVE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=...
GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=...
```

OAuth クライアントは GCP の **OAuth 2.0 クライアント ID**（種別は **デスクトップアプリ** 推奨）で作成します。`GOOGLE_DRIVE_RSVP_FOLDER_ID` のフォルダは **同意した Google アカウントのマイドライブ（またはアクセスできる共有ドライブ）** に置きます。

#### リフレッシュトークン取得（このリポジトリのスクリプト）

1. [認証情報](https://console.cloud.google.com/apis/credentials) → 該当 OAuth 2.0 クライアント → **承認済みのリダイレクト URI** に、`npm run oauth:drive` 実行時にターミナルに表示される URI を **1文字も違わず** 追加して保存する  
   - デフォルトは `http://127.0.0.1:8765/oauth2callback`  
   - **`127.0.0.1` と `localhost` は別物**です。GCP に `localhost` だけ登録している場合は `.env` に  
     `GOOGLE_DRIVE_OAUTH_REDIRECT_URI=http://localhost:8765/oauth2callback`  
     を書いてからスクリプトを再実行する  
   - エラー `redirect_uri_mismatch` の説明は [Google のドキュメント](https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch) を参照
2. `.env` に `GOOGLE_DRIVE_OAUTH_CLIENT_ID` と `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` を入れた状態で、プロジェクト直下で実行（Node 20+）:

```bash
npm run oauth:drive
```

3. 表示された URL をブラウザで開き、**画像を保存したいのと同じ Google アカウント**で許可する  
4. ターミナルに表示された `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=...` を `.env` に貼り付ける  

コールバック URL（`http://127.0.0.1:8765/oauth2callback?code=...`）だけブラウザに出て、ターミナルにトークンが出なかった場合は、`npm run oauth:drive` を動かしたままもう一度試すか、**その URL 全体を引用符で囲んで**次を実行する（`code` はすぐ失効します）:

```bash
npm run oauth:drive:exchange -- "ここにコールバックURLを貼る"
```

※ チャットなどにクライアントシークレットを貼った場合は、取得後に GCP でシークレットを **再生成** することを推奨します。

#### Error 403: access_denied（テスト中のアプリ / 検証未完了）

同意画面に「**検証プロセスが完了していない**」「**テスト中で開発者が承認したテスターのみ**」と出る場合は、OAuth 同意画面が **テスト** のままです。

1. [Google Cloud Console](https://console.cloud.google.com/) → **API とサービス** → **OAuth 同意画面** を開く  
2. 一番下付近の **テストユーザー** で **+ ADD USERS** を押し、**いまブラウザでログインして許可しようとしている Google アカウントのメールアドレス**（例: 自分の `@gmail.com`）を追加して保存する  
3. 数分待ってから、もう一度 `npm run oauth:drive` の URL から許可する  

一般公開（本番）に切り替えると、スコープがセンシティブな場合は [Google の検証](https://support.google.com/cloud/answer/9110914) が必要になることがあります。招待状の自分用トークン取得なら **テストユーザーに自分だけ追加** で足りることが多いです。  
参考: [アプリが未検証であることに関するエラー](https://support.google.com/accounts/answer/3466521?p=app_notverified)

Workspace で **ドメイン全体の委任** でユーザーをなりすまして SA から保存する方式は、[Google の案内](https://support.google.com/a/answer/7281227) を参照してください（設定が重いため、招待状用途では A か B が現実的です）。

## 4. `.env` に設定（ローカル・本番とも同じキー）

プロジェクト直下の `.env` に `GOOGLE_SPREADSHEET_ID` と、認証は **次のどちらか** を設定します（JSON ファイルはリポジトリにコミットしないでください）。

### A. ダウンロードした JSON をパスで指定（ローカル向け）

```bash
GOOGLE_SPREADSHEET_ID=スプレッドシートのID
GOOGLE_DRIVE_RSVP_FOLDER_ID=DriveフォルダのID
# 例: 共有フォルダ URL が
# https://drive.google.com/drive/folders/1LLGWCSWNMsnCpPhSpjxTmTaETTAOKKh4
# のとき → 1LLGWCSWNMsnCpPhSpjxTmTaETTAOKKh4
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/絶対パス/サービスアカウント.json
```

画像を添付する場合は **`GOOGLE_DRIVE_RSVP_FOLDER_ID` が必須**です。画像なしの送信だけなら未設定でも動きます（その場合 `photo` 列は空です）。

`GOOGLE_APPLICATION_CREDENTIALS` に同じく **絶対パス** を入れても同じ動作です（どちらか一方でよい）。

### B. メール + 秘密鍵だけ `.env` に書く（本番ホスト向け）

```bash
GOOGLE_SPREADSHEET_ID=スプレッドシートのID
GOOGLE_DRIVE_RSVP_FOLDER_ID=DriveフォルダのID
# 例: 共有フォルダ URL が
# https://drive.google.com/drive/folders/1LLGWCSWNMsnCpPhSpjxTmTaETTAOKKh4
# のとき → 1LLGWCSWNMsnCpPhSpjxTmTaETTAOKKh4
GOOGLE_SERVICE_ACCOUNT_EMAIL=client_email の値
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"
```

- **A を設定しているときは B は不要**です（JSON 内の `client_email` / `private_key` を読みます）。
- `private_key` を B で使う場合は **1行** にし、改行は `\n` のまま、全体をダブルクォートで囲みます。
- Vercel など **ファイルパスが使えない環境**では B、またはホストが用意する「JSONを1つの環境変数に載せる」方式にしてください。
- **本番で `error:1E08010C:DECODER routines::unsupported` が出る場合**は、ほぼ **`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` の中身が壊れている**ときです。対処:
  - **Vercel / ダッシュボードの環境変数**では、値フィールドに `-----BEGIN PRIVATE KEY-----` から `-----END PRIVATE KEY-----` までを貼り、**先頭末尾に `"` を付けない**（`.env` 用のクォートをそのままコピーしない）。
  - 改行は **実改行**でも **`\n` にした1行**でもよい。途中の Base64 が欠けていないか確認する。
  - 可能なら **JSON ファイル方式（A）**をビルド時シークレットやホストの「ファイルマウント」で渡すとトラブルが少ないです。
- 画像を **サービスアカウントだけ** で上げる場合は **共有ドライブ内フォルダ** の ID を `GOOGLE_DRIVE_RSVP_FOLDER_ID` にしてください。OAuth（`GOOGLE_DRIVE_OAUTH_*`）を設定しているときは、マイドライブ上のフォルダでも可です。

## 5. 列について

初回送信時に 1 行目へ日本語の列名（どちらのゲスト様、ご関係、… ご出欠）が自動で入ります。選択肢の値も日本語で書き込まれます。先に手動で 1 行目を用意しても構いません（列の並びは上記と同じ順である必要があります）。

**先頭のシート**（左端のタブ）に追記されます。シート名が日本語の「シート1」でも問題ありません。

## 注意

- アップロード後、ファイルに **リンクを知っている全員が閲覧可** の権限を付与しています（新郎新婦がリンクから開けるようにするため）。より厳しい公開範囲にしたい場合は `src/app/api/rsvp/route.ts` の `permissions.create` を変更してください。
- 画像は **image/* のみ**、サイズ上限は API 側で **15MB** です。ホスティング（例: Vercel）によってはリクエスト全体の上限で先に弾かれることがあります。
- `.gitignore` で `.env*` が無視されるため、`.env` はコミットされません。
