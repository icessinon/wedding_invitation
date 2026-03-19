# partyInfo セクションのフォントサイズ一覧

## タイトル（SVG テキスト・PartyTitle）
| 要素 | PC | モバイル (768px以下) |
|------|-----|---------------------|
| タイトル文字（PARTY / INFORMATION） | **70px**（SVG viewBox 内） | **65px** |

※ SVG の `fontSize` 属性と CSS の `.titleText` / `.titleTextHidden` で指定。

## その他のテキスト（partyInfo.module.css）
| クラス | 用途 | PC | モバイル |
|--------|------|-----|----------|
| `.header` | セクション見出し | 1.2rem | 1rem |
| `.dateLabel` | 日付ラベル | 1.3rem | 1.1rem |
| `.dateValue` | 日付の値 | 1.4rem | 1.2rem |
| `.boxTitle` | 枠内タイトル（挙式・会場など） | 1.2rem | 1.1rem |
| `.timeLabel` | 時間ラベル | 0.95rem | 0.95rem |
| `.timeValue` | 時間の値 | 1.3rem | 1.1rem |
| `.timeSeparator` | 〜 など | 1rem | 1rem |
| `.venueLabel` | 会場ラベル | 0.95rem | 0.95rem |
| `.venueValue` | 会場名 | 1.1rem | 1rem |

## 文字がはみ出る対策（モバイル）
- タイトルは 1文字あたり PC 12% / モバイル **8%** の幅で配置。
- モバイルでは字間を縮小し、フォントを **65px** に統一して収まるようにしている。
