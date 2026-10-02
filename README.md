# Hand Motion Visual FX

MediaPipe Hand Landmarker を使い、カメラ映像をブラウザ内だけで加工する Vite アプリです。

## 起動

`npm install` の後、`npm run dev`。カメラ権限を許可してください。HTTPS（localhost を含む）が必要です。

## 実装済み

- 2手・21ランドマーク、指骨格/番号デバッグ、開いた手・握り手の安定判定
- Hand Cube（指先からの3D距離調整）、二手の Hand Frame（Pop Art / 8-bit / Invert）、簡易Volume
- Hand Frame 内限定の MOSW FX（RGB / GLITCH / MIRROR / WAVE / MONO / INVERT / MOSAIC / STROBE / ZOOM / FILM）
- Hand Frame の CLASSIC / MOSW FX 切替、MOSW FX の最大3段合成、ドラッグによる適用順変更、手動BPM / マイク入力同期
- Glass / Chrome / 背景キャプチャを使う簡易Invisible、従来/HAND FLOW切替対応の2D Particle Dissolve
- Anime Frame のFace Landmarker連動Canvas絵文字（5表情、2人、GPU/CPUフォールバック）
- カメラ切替、ミラー、全画面、スクリーンショット、WebM録画、設定JSON入出力
- GitHub Pages 用の base 設定と Actions ワークフロー

## 未実装・制限

Face Landmarker と人物セグメンテーションのモデルは初回にネットワークから取得します。取得できない場合もカメラと従来のAnime Frameは動作します。Three.jsのVideoTexture、GLSLによる高品質なTwist/Anime処理は未実装です。Invisible/Glass/Chrome は全画面に適用する簡易表現です。実機 iPhone Safari は未検証です。
