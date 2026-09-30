# Hand Motion Visual FX

MediaPipe Hand Landmarker を使い、カメラ映像をブラウザ内だけで加工する Vite アプリです。

## 起動

`npm install` の後、`npm run dev`。カメラ権限を許可してください。HTTPS（localhost を含む）が必要です。

## 実装済み

- 2手・21ランドマーク、指骨格/番号デバッグ、開いた手・握り手の安定判定
- Hand Cube、二手の Hand Frame（Pop Art / 8-bit / Invert）、簡易Volume
- Hand Frame 内限定の MOSW FX（RGB / GLITCH / MIRROR / WAVE / MONO / INVERT / MOSAIC / STROBE / ZOOM / FILM）
- MOSW FX の最大3段合成、ドラッグによる適用順変更、手動BPM / マイク入力同期
- Glass / Chrome / 背景キャプチャを使う簡易Invisible、2D Particle Dissolve
- カメラ切替、ミラー、全画面、スクリーンショット、WebM録画、設定JSON入出力
- GitHub Pages 用の base 設定と Actions ワークフロー

## 未実装・制限

人物領域の正確なセグメンテーション、Face Landmarker、Three.jsの真の3D VideoTexture、GLSLによる高品質なTwist/Anime処理は未実装です。Invisible/Glass/Chrome は全画面に適用する簡易表現です。実機 iPhone Safari は未検証です。
