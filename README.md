# Alaska Jam LIVE TRAINING

縦画面スマホでライブのアクションを練習する静的Webアプリ。
2026/12/2 渋谷CLUB QUATTROへの導線を想定したMVPです。公演日・会場は依頼時の指定情報です。チケットURLは未指定のため、架空のリンクは設けていません。

## MVP

- 8曲の一覧。CAT WALK LIFEのみ40秒・19アクションのダミー練習。残り7曲は準備中。
- 実音源なし。ダミー譜面は実曲のテンポ・構成や公式Cheering Guideを再現しません。
- 3秒カウントダウン、1.8秒前から予告、タイミングバー、PERFECT / GOOD / MISS。
- CLAP / CALL / JUMP = タップ。WIPER = 指示方向へ左右スワイプ。
- CALLの声やJUMPの実動作は任意。マイク・カメラ・位置情報は一切使用しません。
- 一時停止・再開・画面非表示時の自動停止・リトライ。
- 結果の主役は「QUATTRO参戦準備度」。同じ端末にベストのみ保存。保存不可でもプレイ可能。
- ログイン・DB・有料API・外部フォント・計測・広告・ランタイム依存なし。

## 操作・採点

バーが満ちる時刻に、黒いアクションパッドで指を離します。
タップは移動20px未満・400ms未満。スワイプは横36px以上、縦移動の1.3倍超、800ms未満。
PCはSpace、左右矢印キー。Escapeで一時停止。

PERFECTは±0.12秒、GOODは±0.28秒。それを過ぎたノートや判定範囲内の違う操作はMISS。
判定範囲より早い操作はノートを消費しません。同じノートへの二重加点はありません。
準備度 = round((PERFECT数 + GOOD数 × 0.7) / 全ノート数 × 100)。実ライブの習熟度評価ではありません。

## ローカル起動・テスト

Node.js 22以降。追加インストール不要。

```sh
npm start
# http://127.0.0.1:4173
npm test
```

file://からの直接起動はJSONの読み込み制限があるため、上記サーバーかGitHub Pagesを利用します。

## GitHub Pages

この公開リポジトリの Settings → Pages → Deploy from a branch → main / (root) を保存。
公開先： https://drteddy0304.github.io/alaskajam-live-training/
ビルドなし。相対パスで配信するためGitHub Pagesのサブディレクトリで動きます。
GitHub Freeの公開リポジトリでPagesを利用できます。
公式手順：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## ファイル構成

- `index.html` / `style.css`：ホーム・練習・結果
- `app.js`：表示、入力、停止・再開、保存、任意音源の再生
- `engine.js`：DOMに依存しない譜面検証と採点
- `data/songs.json`：一覧と譜面参照
- `data/demo.json`：秒単位の譜面と出典情報
- `tests/engine.test.js`：採点・方向・境界・譜面検証

## 公式Cheering Guide・権利処理済み音源への差し替え

1. **公式Cheering Guideを正本**として、対象曲・版・出典URL・秒単位の動作を確認する。推測で公式譜面を作らない。
2. `data/demo.json`を複製して曲ごとのJSONを作る。`id`は曲と譜面改訂ごとに新しくする（ベスト記録を混ぜない）。
3. `source.name / url / revision`に正本と版を記録。`kind`を`official`にする。各`notes`は時刻順の`{ "time": 12.5, "action": "CLAP" }`形式。WIPERには`"direction": "left"`または`"right"`を必須とする。
4. `duration`を秒数で指定し、最後のノートの0.28秒後以降にする。`leadTime`は予告秒数。現在のエンジンは単一アクション、隣接ノートの間隔は0.56秒超を必要とする。密な譜面・同時押しはエンジンの仕様変更とテストが必要。
5. 配信許諾を確認した音源だけを`assets/audio/`へ追加。`audio`を`{ "src": "./assets/audio/example.mp3", "offset": 0 }`へ変更。`offset`は譜面の0秒に相当する音源側の開始秒（0以上）。再生開始後は音源のcurrentTimeを採点の時計に使用する。
6. `data/songs.json`の該当曲へ`chart`パスを追加し、`status`を`ready`へ変更すると選択できる。ホーム・結果・フッターの体験版表記も正式な公開内容に合わせて更新する。初回体験ボタンは最後に読み込んだ譜面を再生する。
7. 正式な公演・チケットURLを確認後、ホームと結果の公演欄にリンクを設ける。

### 公開前チェック

音源差し替え後は実機Safari / Chromeで同期・バックグラウンド停止・音源の読込失敗・再開を再確認してください。今回のMVPは無音モードを検証対象とします。端末固有の入力遅延補正、オフラインキャッシュ、公式音源、全曲譜面は未実装です。
