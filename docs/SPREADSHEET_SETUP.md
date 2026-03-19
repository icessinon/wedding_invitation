# エントリーフォーム → Google スプレッドシート 連携

フォームの送信内容を Google スプレッドシートに記録する手順です。

## 1. スプレッドシートを用意

1. [Google スプレッドシート](https://sheets.google.com) で新しいスプレッドシートを作成
2. 1行目に次のヘッダーを入力（または最初の送信時に自動で1行目に書き込まれます）

| guestSide | relation | relationship | guestName | guestNameKana | gender | postalCode | address | email | allergy | transport | trainTransfer | hasChildren | jointName | message | photo | attendance |
|-----------|----------|--------------|------------|---------------|--------|------------|---------|-------|---------|-----------|---------------|-------------|-----------|----------|-------|------------|

## 2. Google Apps Script を設定

1. スプレッドシートのメニュー **拡張機能** → **Apps Script**
2. 表示されたエディタで、既存の `function myFunction() {}` を削除し、下の **Code.gs** の内容をそのまま貼り付けて保存

## 3. Code.gs（コピー用）

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const json = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(json);

    const headers = [
      'guestSide', 'relation', 'relationship', 'guestName', 'guestNameKana', 'gender',
      'postalCode', 'address', 'email', 'allergy', 'transport', 'trainTransfer',
      'hasChildren', 'jointName', 'message', 'photo', 'attendance'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    const row = headers.map(function (key) {
      return data[key] != null ? String(data[key]) : '';
    });
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 4. デプロイ

1. Apps Script エディタで **デプロイ** → **新しいデプロイ**
2. 種類で **Web アプリ** を選択
3. **次のユーザーとして実行**: 自分
4. **アクセスできるユーザー**: **全員**（匿名でもフォーム送信できるようにする）
5. **デプロイ** をクリック
6. 表示された **Web アプリの URL** をコピー

## 5. 招待状サイトに URL を設定

`src/app/page.tsx` で EntryForm に URL を渡します。

```tsx
<EntryForm
  responseDeadline="2026年○月○日"
  spreadsheetWebAppUrl="https://script.google.com/macros/s/xxxxxxxx/exec"
/>
```

または環境変数で管理する場合（推奨）:

```tsx
<EntryForm
  responseDeadline="2026年○月○日"
  spreadsheetWebAppUrl={process.env.NEXT_PUBLIC_SPREADSHEET_WEB_APP_URL}
/>
```

`.env.local` に追加:

```
NEXT_PUBLIC_SPREADSHEET_WEB_APP_URL=https://script.google.com/macros/s/xxxxxxxx/exec
```

## 注意

- 画像はファイル名のみスプレッドシートに記録されます。画像本体を保存したい場合は Drive にアップロードする処理を GAS 側で追加する必要があります。
- 初回アクセス時に「承認が必要」と表示されたら、自分の Google アカウントで許可してください。
