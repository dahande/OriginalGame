# Bubble Smash 🫧💥

クリック / タップで バブルを 連続爆破して、ストレスを 吹き飛ばす ブラウザゲーム。
Canvas 2D + Web Audio API のみで動く 軽量なシングルページアプリで、PC でも スマホでも 遊べます。

![bubble](https://img.shields.io/badge/play-browser-ff5fa2) ![tech](https://img.shields.io/badge/tech-canvas%20%2B%20webaudio-5ad7ff) ![license](https://img.shields.io/badge/license-MIT-ffd860)

---

## 遊び方

1. `スタート` を 押す
2. 浮かんでくる **バブル** を マウスクリック / タップ で 割る
3. 連続で 割ると **コンボ倍率** が 上がる ( 最大 8 倍 )
4. ハイスコアを 更新しよう

### バブルの 種類

| 種類 | 効果 | 基礎スコア |
| --- | --- | --- |
| 通常 | パッと 弾ける | 10 |
| ボム | 周囲の バブルも 連鎖爆破 | 30 |
| レインボー | 画面上の 全バブルを 一掃 | 25 + 連鎖 |
| ゴールド | 高得点 | 100 |

> コンボが 10, 20, 30 ... に 到達すると `COMBO!` が 派手に 出ます。

### 操作

- マウス / タッチ : バブルを 割る
- `R` キー : リスタート
- 右上の ⚙ : 設定 ( サウンド / 振動 / エフェクト量 / 難易度 )

---

## ローカルで 動かす

ES Modules を 使っているので、ファイルを 直接開く ( `file://` ) ではなく、
HTTP サーバー経由で 起動してください。

```bash
# Python が ある場合
python3 -m http.server 8080

# あるいは Node の serve
npx serve -l 8080 .
```

ブラウザで `http://localhost:8080/` を 開く。

---

## デプロイ ( GitHub Pages )

`main` ブランチに マージすると、`.github/workflows/pages.yml` が 自動で
GitHub Pages に デプロイします。
リポジトリの **Settings → Pages → Build and deployment → Source** を
`GitHub Actions` に 設定してください。

公開後は `https://<user>.github.io/<repo>/` で 遊べます。

---

## ファイル構成

```
.
├── index.html          # エントリポイント
├── src/
│   ├── main.js         # 起動 / UI 配線
│   ├── game.js         # ゲームループ / 描画 / 衝突判定
│   ├── bubble.js       # バブル種別とレンダリング
│   ├── particles.js    # オブジェクトプール式 パーティクル
│   ├── audio.js        # Web Audio で 効果音を 合成
│   ├── storage.js      # localStorage で 設定 / ベスト記録
│   └── styles.css      # UI / オーバーレイ
└── .github/workflows/
    └── pages.yml       # GitHub Pages デプロイ
```

---

## 設計メモ

- **依存ゼロ** : npm パッケージなし。ブラウザ標準 API のみ。
- **DPR 対応** : `devicePixelRatio` を 反映して Retina でも 鮮明。
- **オブジェクトプーリング** : バブル / パーティクルは 使い回し、GC 圧を 抑制。
- **Web Audio で 合成** : 音声ファイルを 使わず、レイテンシゼロで 即時再生。
- **アクセシビリティ** : `prefers-reduced-motion` を 尊重、`aria-live` で スコアを 通知。
- **モバイル最適化** : `touch-action: none` / `viewport-fit=cover` で フルスクリーン体験。

---

## ライセンス

MIT — 自由に 改造して 遊んでください。
