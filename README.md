# Hand Motion Visual FX

MediaPipe Hand Landmarker を使い、カメラ映像をブラウザ内だけで加工する Vite アプリです。

## 起動

`npm install` の後、`npm run dev`。カメラ権限を許可してください。HTTPS（localhost を含む）が必要です。

## 実装済み

- 2手・21ランドマーク、指骨格/番号デバッグ、開いた手・握り手の安定判定
- Hand Cube（5本の指を個別選択、0〜10仮想cmとCAMERA / UP / OUTWARD方向の3D距離調整）、二手の Hand Frame（Pop Art / 8-bit / Invert）、簡易Volume
- Hand Frame 内限定の MOSW FX（RGB / GLITCH / MIRROR / WAVE / MONO / INVERT / MOSAIC / STROBE / ZOOM / FILM）
- Hand Frame の CLASSIC / MOSW FX 切替、MOSW FX の最大3段合成、ドラッグによる適用順変更、手動BPM / マイク入力同期
- OPENの手振りで透明化・敬礼で解除するInvisible、HAND/BODY自動切替と4形状に対応するParticle
- ウィンクで静止画を固定し、顔・Pose・手へ追従するHand Frame PHOTO LOCK
- Hand Cube / Hand Volume共通の速度履歴ベースThrow Physics
- Anime Frame のFace Landmarker連動Twemoji（5表情、2人、両手フレーム内クリップ、GPU/CPUフォールバック）
- カメラ切替、ミラー、全画面、スクリーンショット、WebM録画、設定JSON入出力
- GitHub Pages 用の base 設定と Actions ワークフロー

## 未実装・制限

Face Landmarker と人物セグメンテーションのモデルは初回にネットワークから取得します。取得できない場合もカメラと従来のAnime Frameは動作します。Three.jsのVideoTexture、GLSLによる高品質なTwist/Anime処理は未実装です。Invisible/Glass/Chrome は全画面に適用する簡易表現です。実機 iPhone Safari は未検証です。

## 絵文字アセット

Anime Frame は [Twemoji](https://github.com/twitter/twemoji) 14.0.2 のSVGを jsDelivr から事前読み込みします。Copyright Twitter, Inc. and other contributors. Graphics licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。ネットワークから取得できない場合は、端末の標準絵文字へフォールバックします。
