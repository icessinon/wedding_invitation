/**
 * 結婚式エントリーフォーム → スプレッドシート連携
 * 使い方: このファイルの内容を Google Apps Script エディタに貼り付け、
 * 「デプロイ」→「新しいデプロイ」→「Web アプリ」でデプロイし、表示された URL を
 * EntryForm の spreadsheetWebAppUrl に設定してください。
 * 詳細: docs/SPREADSHEET_SETUP.md
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var json = e.postData ? e.postData.contents : '{}';
    var data = JSON.parse(json);

    var headers = [
      'guestSide', 'relation', 'relationship', 'guestName', 'guestNameKana', 'gender',
      'postalCode', 'address', 'email', 'allergy', 'transport', 'trainTransfer',
      'hasChildren', 'jointName', 'message', 'photo', 'attendance'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    var row = headers.map(function (key) {
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
