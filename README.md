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

## Invisible Trigger Settings

Invisible の PARAMETERS → TRIGGER SETTINGS で ON / OFF それぞれに OPEN、FIST、OPEN WAVE、SALUTE、WINK を選べます。既定は **OPEN 300ms / FIST 300ms**。Hold は 100〜2000ms（50ms刻み）で、検出した条件の連続保持時間です。手の認識安定化（固定120ms）とは別に計測します。旧 `gestureHold` 設定は使用しません。

- OPEN / FIST: 親指を除く4指について「指先と手首の距離 > 第2関節と手首の距離 × 1.12」を伸展と評価。3本以上で OPEN、1本以下で FIST、2本なら UNKNOWN。
- OPEN WAVE: OPEN の手の中心が直近1200msで横方向に0.14以上移動し、0.008を超える動きの反転が2回以上ある間を条件として、その後のHoldを計測。
- SALUTE: OPEN の手が顔のこめかみ領域にある間を計測（顔サイズに対して横0.18〜0.75、顔中心から上0.3の位置に縦±0.4）。顔検出が必要です。
- WINK: 片目の blink > 0.65、反対の目 < 0.35 を連続保持。両目閉じは対象外。左右の切替でHoldをやり直します。

`InvisibleTriggerConditions` が条件を判定し、`HoldTriggerEngine` が同じ手／同じ目のHold・400msのクールダウン・再発火ロックを管理、`InvisibleGestureController` が発火イベントとフェード状態を管理します。VISIBLEでON、INVISIBLEでOFFのみ評価し、フェード中はHoldを蓄積しません。発火した条件が解除されるまで再発火しないため、ON/OFFを同じジェスチャーにしても保持したまま往復しません。設定変更は途中のHoldを取り消し、既存の再発火ロックは維持します。

設定はlocalStorage、EXPORT / IMPORT JSONに対応し、RESET SETTINGSで既定に戻ります。INVISIBLE DEBUGでは状態、検出条件、ON/OFFのHoldとREADY、発火通知、選択した条件ごとの波形・敬礼位置・左右blinkの診断値を表示します。Background Capture / Difference、人物マスク、Transition、既存の各DebugとMirrorは従来どおりです。

確認コマンド: `npm test`（境界時間、再発火防止、遷移中抑止、5条件、設定検証を含む）、`npm run build`。実機カメラ・iPhone Safariでのジェスチャー精度は別途確認が必要です。
