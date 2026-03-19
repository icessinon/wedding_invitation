export interface EntryFormProps {
  /** 出欠回答の期限日（表示用） */
  responseDeadline?: string
  /**
   * Google Apps Script の Web アプリ URL（デプロイ後の URL）。
   * 設定すると送信内容がスプレッドシートに追記されます。
   */
  spreadsheetWebAppUrl?: string
}
