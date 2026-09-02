# SOCIAL UP! 教材データ仕様（CONTENT_SPEC）

このファイルを読めば、アプリ本体（index.html）を読まなくても問題を追加できる。
教材データの source of truth は `data/` 配下の JSON だけ。index.html には問題を持たない。

SOCIAL UP! の教材は2種類ある。

- **4択（quiz）**: 地理・歴史・公民の4択問題
- **年代整序（order）**: できごとを古い順に並べるセット

## 1. ファイル一覧

| ファイル | 種類 | 役割 |
|---|---|---|
| `data/index.json` | manifest | ファイル一覧と件数 |
| `data/geo.json` | quiz | 地理（世界と日本） |
| `data/his.json` | quiz | 歴史（古代〜現代） |
| `data/civ.json` | quiz | 公民（政治・経済） |
| `data/order.json` | order | 年代整序 |
| `scripts/validate-content.mjs` | | データ検証（Node.js、追加パッケージ不要） |
| `scripts/format-content.mjs` | | データ整形（同上） |
| `sw.js` | | Service Worker。オフライン用にデータをキャッシュする |

## source of truth

**教材の唯一の source of truth は `data/*.json` である。** 教材を直すときは JSON を直接編集し、`format-content.mjs` → `validate-content.mjs` を通して commit する。過去に JSON を生成するために使った元原稿（引き継ぎ資料の `add_*.js` `fix_*.js` など）は、生成が終わった時点で役目を終えた作業ファイルであり、今後の source of truth ではない。JSON と元原稿を別々に更新する運用はしない。

## 2. manifest（data/index.json）の schema

```json
{
  "version": 1,
  "sets": [
    {"id":"geo","name":"地理（世界と日本）","file":"geo.json","kind":"quiz","count":138},
    {"id":"his","name":"歴史（古代〜現代）","file":"his.json","kind":"quiz","count":144},
    {"id":"civ","name":"公民（政治・経済）","file":"civ.json","kind":"quiz","count":133},
    {"id":"order","name":"年代整序","file":"order.json","kind":"order","count":55}
  ],
  "total": 415,
  "orderTotal": 55
}
```

| property | 必須 | 意味 |
|---|---|---|
| `version` | 必須 | `1` 固定 |
| `sets[].id` | 必須 | quiz は分野 ID（`geo` `his` `civ`）、年代整序は `order` |
| `sets[].name` | 必須 | 表示名（参考情報。アプリは index.html 内 `FIELDS` を使う） |
| `sets[].file` | 必須 | `data/` からの相対ファイル名 |
| `sets[].kind` | 必須 | `quiz` または `order`。アプリはこれで読み分ける |
| `sets[].count` | 必須 | そのファイルの items 件数 |
| `total` | 必須 | quiz の count 合計 |
| `orderTotal` | 必須 | order の count 合計 |

## 3. 4択（geo / his / civ）の schema

```json
{
  "id": "geo",
  "name": "地理（世界と日本）",
  "items": [
    {"id":"g_e1","f":"geo","lv":"easy","q":"地球上の位置を表すとき、赤道を0度として南北を測るものはどれか。","ch":["緯度","経度","標高","時差"],"a":0,"ex":"赤道が緯度0度で、南北にそれぞれ90度まである。経度はイギリスの旧グリニッジ天文台を0度として東西に180度まで。"}
  ]
}
```

ファイルの `id` と `name` は manifest の同じ set と一致させる。

| property | 型 | 必須 | 意味 |
|---|---|---|---|
| `id` | string | 必須 | 問題 ID。全ファイルで一意 |
| `f` | string | 必須 | 分野。ファイルの分野と一致（`geo` `his` `civ`） |
| `lv` | string | 必須 | `easy`（基礎 中1〜中2）/ `std`（標準 中3）/ `hard`（入試） |
| `q` | string | 必須 | 問題文 |
| `ch` | string[4] | 必須 | 選択肢。ちょうど4件、重複なし。表示時にアプリがシャッフルする |
| `a` | integer | 必須 | 正答 index。**0 始まり**。0〜3 |
| `ex` | string | 必須 | 解説 |

これ以外の property は追加しない。

選択肢の長さから正解を当てられないよう、誤答の長さは正解と揃える（`validate-content.mjs` は形式だけを見る。長さの偏りは別途目で確認する）。

## 4. 年代整序（order.json）の schema

```json
{
  "id": "order",
  "name": "年代整序",
  "items": [
    {
      "id": "o_e1",
      "lv": "std",
      "q": "古代の日本のできごとを古い順に並べよう。",
      "items": [
        ["稲作が伝わり弥生時代が始まる","紀元前4世紀ごろ","大陸から伝わり、ムラができ貧富の差が生まれた"],
        ["卑弥呼が魏に使いを送る","239年","魏志倭人伝に記され、「親魏倭王」の称号を得た"],
        ["大和政権が各地を統一していく","5世紀ごろ","前方後円墳が各地に広がったことがその証拠"],
        ["聖徳太子が冠位十二階を定める","603年","家柄ではなく能力で役人を登用しようとした"],
        ["大化の改新が始まる","645年","中大兄皇子と中臣鎌足が蘇我氏を倒した"]
      ]
    }
  ]
}
```

| property | 型 | 必須 | 意味 |
|---|---|---|---|
| `id` | string | 必須 | セット ID。`o_` で始める。全ファイルで一意 |
| `lv` | string | 必須 | `easy` / `std` / `hard` |
| `q` | string | 必須 | 指示文 |
| `items` | array | 必須 | できごとの配列。**正しい（古い）順に書く**。アプリが表示時にシャッフルする。3〜5件 |
| `items[n]` | [string, string, string] | 必須 | `[できごと, 年代の表記, 補足（解説に出る）]`。3要素すべて空にしない |

年代の表記は「239年」「5世紀ごろ」「紀元前4世紀ごろ」のような自由な文字列で、アプリは並び判定に使わない。判定は `items` の並び順そのもの。

## 5. ID の命名規則

- 4択: `<分野1文字>_<種別1文字><通し番号>`。分野: `g`=geo, `h`=his, `c`=civ。種別: `e`=easy, `s`=std, `h`=hard（難易度は `lv` が正）
- 年代整序: `o_<英字><通し番号>`。英字はテーマ（`e` `s` `h` のほか `a` `b` `c` `w` `g` `v` など）で、難易度とは対応しない
- 使える文字は英数字と `_` `-`。既存の最大番号の次を使う

### 一度公開した ID を変えてはいけない理由

学習記録は localStorage に `stats[問題ID]` として保存され、苦手判定・復習間隔・今日の問題の選び方がこれに依存する。ID を変えるとその問題は未着手扱いに戻る。内容を直すときは ID を保ち、削除した ID を再利用しない。

## 6. 文字コードと JSON 形式

- UTF-8（BOM なし）、LF。日本語はそのまま書き、`\uXXXX` に escape しない
- 4択は問題1件を1行、年代整序はセットを複数行にしてできごと1件を1行にする（`node scripts/format-content.mjs` が整える）
- 制御文字を入れない

## 7. 追加する手順

1. 該当ファイルの `items` 末尾に足す
2. `data/index.json` の該当 `count` と、`total`（4択）または `orderTotal`（年代整序）を増やす
3. `node scripts/format-content.mjs` → `node scripts/validate-content.mjs` で `✓ OK`
4. ローカルサーバで確認（第9節）
5. 必要なら index.html の `APP_VER` を上げる。commit する。push は田中が行う

## 8. validator と formatter

```
node scripts/validate-content.mjs
node scripts/format-content.mjs
node scripts/format-content.mjs --check
```

Node.js 18 以上、npm install 不要。validator は JSON / UTF-8 / manifest の参照 / count と total と orderTotal / 必須 property と型 / ID の空・重複・接頭辞 / 分野・難易度・kind / 空文字と制御文字 / 選択肢4件と重複 / 正答 index / 年代整序の3要素・件数・できごとの重複 / 未参照 JSON や `.DS_Store` を見る。

## 9. ローカルで動かす

```
cd social-up
python3 -m http.server 8000
# http://localhost:8000/
```

file:// では fetch が動かないので、必ずサーバ経由で開く。

## 10. Service Worker と教材更新の関係

- `sw.js` は index.html と `data/*.json` を network-first で取得する。オンラインなら常に最新 JSON が届き、オフライン時だけキャッシュを返す
- JSON を更新するだけなら `sw.js` の `CACHE` 名を変えなくてよい
- `data/` にファイルを増やしたら `sw.js` の `ASSETS` に追加し、`CACHE` の版数を上げる（precache に失敗すると新しい Service Worker は install されず、旧版が使われ続ける。ASSETS の path 間違いに注意）
- cache 名は `socialup-` で始まり（`CACHE_PREFIX`）、古い cache の掃除はこの prefix を持つものだけを対象にする。同じ origin にある他の BioSprout アプリの cache には触れない
- 404 や 500 などの error response は cache に保存しない。network が error を返したときは、正常な cache があればそちらを返す

## 11. してはいけない変更

- 公開済み `id` の変更・再利用
- `a` を 1 始まりにする、`ch` を4件以外にする
- item への property 追加
- 年代整序の `items` を正しい順以外で書く
- index.html に問題の fallback copy を戻す
- ファイル分割や schema の再設計
