# URL クエリパラメータ一覧（招待サイト）

環境変数は [`.env.example`](../.env.example)。OAuth スクリプトの `?code=` はゲスト向けではない。

封筒を開く前の短い案内文は **固定**（`タップしてお手紙をご覧ください`）。URL では変えられない。

---

## 1. 受付・参列時刻 `r` / `reception`

**参照:** [`partyInfo/index.tsx`](../src/components/partyInfo/index.tsx)、[`other/index.tsx`](../src/components/other/index.tsx)

| パラメータ | 例 |
|------------|-----|
| `r` | `?r=0` |
| `reception` | `?reception=1` |

`r` を優先。値 `0` / `1` / その他（既定 `2`）で受付・参列の表示時刻が変わる。

---

## 2. 手紙の本文（開封後の `.letterMessage`）

**参照:** [`entryForm/envelopeOpenHint.ts`](../src/components/entryForm/envelopeOpenHint.ts)（`GUEST_LETTER_BY_CODE`）、[`entryForm/index.tsx`](../src/components/entryForm/index.tsx)

`resolveLetterBody` が文字列を返すとその内容が表示され、**何も無いときだけ**組み込みの固定文になる。

### 2.1 数字コード `e` / `code`

値は数字のみ・最大 12 桁。定義は **`GUEST_LETTER_BY_CODE`**。未登録は URL の `letter*` にフォールバック。

### 2.2 クエリで本文を直接指定

| パラメータ | 短い別名 | 用途 |
|------------|----------|------|
| `letter` | `msg` | 出欠が取れない成功時のほか、出席・欠席専用が無いときのフォールバック |
| `letterAttend` | `msgAttend` | **ご出席** のとき |
| `letterAbsent` | `msgAbsent` | **ご欠席** のとき |

改行は `\n` または `%0A`。長文はエンコード推奨。

### 2.3 出席扱い（`msgAttend` などを使う条件）

- 送信成功かつフォームでご出席
- または送信成功で出欠が null かつ `attendance=attend` または `rsvp=attend`

---

## 優先順位（手紙本文）

1. 登録コードの `letter` / `letterAttend` / `letterAbsent`（未設定は URL で補完）
2. URL の `letter` / `letterAttend` / `letterAbsent`（別名 `msg*` 可）
3. 組み込みの既定文

---

## 実装メモ

- `PartyInfo` / `Other`: `useSearchParams`（`page.tsx` で Suspense）
- 手紙用ヒント: `window.location.search` を `useEffect` で取得

---

## スプレッドシート列（連名）

API は **`jointPartnerNames`** 列に、連名ありのとき **改行区切り**で複数名を保存する（表示用にセル内では `、` に整形される場合あり）。既存シートには手動で列を追加する必要がある。
