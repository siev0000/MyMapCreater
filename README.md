# MyMapCreater — Game Creator Tools

[ツール選択画面](./index.html) からマップ・名前生成・図形カタログ・エフェクト作成へ移動できます。
各ツールのヘッダー左端に共通ホームアイコンがあります。押すと未保存の内容が失われる可能性を確認し、OK時のみ選択画面へ戻ります。新規ツールはヘッダーに `data-tool-home` を付け、`shared/tool-home.js` と `shared/tool-home.css` を読み込んで共通化します。検証: `node shared/tool-home.test.cjs`。

- [エフェクト作成](./tools/effect-creator/index.html) — GLSLを初期描画方式とするアニメーション編集・透過スプライトシート出力。CS雷魔法24種のCanvas/GLSL専用プリセットとGLSL試作（連鎖球雷）、属性別の他魔法320種のGLSL初期制作案、GLSLコード編集・レイヤー合成と制作備考を収録。
- [GLSL部品組み合わせ制作（試作）](./tools/effect-creator/component-studio.html) — 部品ライブラリ、タイムライン、単体・全体プレビュー、構成保存・透過画像出力。既存魔法の置換はしない。
- [エフェクト作成仕様・制約](./docs/specs/12-effect-creator.md)
- **[最新の作業引き継ぎ](./docs/HANDOFF.md)** — 作業再開時に読む。進捗・確定事項・未完了・次の手順を管理し、作業の区切りで更新する。
- [名前生成](./rebuild/name-generator.html) / [図形カタログ](./rebuild/shape-catalog.html)

## マップ制作機能

ワールドマップ、町、施設、船、ダンジョンなどの**任意のマップ**を、JSONデータから描画・編集するブラウザーアプリです。オートマンのマップはサンプルデータの一つであり、描画プログラムに固有の施設名や構造を登録する必要はありません。

## 画面

- **[マップ閲覧](./rebuild/header.html)** — 大マップ・マップ切替、大枠→中枠のツリー、拡大縮小、図形選択。
- **[マップ編集](./rebuild/editor.html)** — 図形追加・削除・複製、座標・形状・色・透過・レイヤー・名前・親子関係の変更、移動モード、Undo/Redo、JSONの読み込み・ダウンロード。
- [JSON Scene v2 仕様](./rebuild/SCENE_FORMAT_v2.md)
- [架空の町のサンプル](./rebuild/examples/sample-town.scene.json)

## 仕様書（項目別）

汎用アプリの機能仕様・次期開発計画は **[docs/specs/ 仕様書目次](./docs/specs/README.md)** に分割して管理します。

- [アーキテクチャ](./docs/specs/01-architecture.md)
- [表示Lv・親子階層と表示](./docs/specs/02-hierarchy-and-visibility.md)
- [図形・直接編集](./docs/specs/03-geometry-and-editing.md)
- [壁・扉・開口・接続](./docs/specs/04-walls-doors-and-connections.md)
- [JSON・保存・検証](./docs/specs/05-data-and-validation.md)
- [施設内部までの実装タスク](./docs/specs/06-roadmap-and-acceptance.md)
- [物理フロア・施設内部](./docs/specs/07-floors-and-interiors.md)
- [大型設備・家具の配置](./docs/specs/08-placeable-objects.md)
- [室内物資の文字アイコン対応](./docs/specs/09-indoor-supply-icon-catalog.md)
- [図形のみの家具・設備プレビュー](./docs/specs/10-shape-only-catalog.md)

**現行の実装形式**は引き続き [Scene JSON v2](./rebuild/SCENE_FORMAT_v2.md) です。仕様書内の `displayLevel` 数値化や壁・扉の連動は次期実装予定であり、まだ実装済みではありません。

## データの分離

| ファイル | 役割 |
|---|---|
| `rebuild/map-viewer.js` | 汎用描画エンジン。施設・地名・世界設定の個別処理を持たない |
| `rebuild/map-editor.js` | 汎用の編集・履歴・ファイル入出力 |
| `rebuild/map-tree.json` | 大マップ・マップ選択と参照するシーンファイル |
| `rebuild/scenes/*.scene.json` | 実際の描画データ（形状・座標・線・色・階層・文字など） |
| `data/*-layout-draft.json` | オートマンの元の配置データ。汎用化時に変更していない |
| `legacy/` | 以前のオートマン専用編集・比較ツールの参照用バックアップ |

図形は `rect`、`polygon`、`polyline`、`circle`、`ring`、`none` に対応しています。壁と道路は特定の図形の自動変換ではなく、JSONで独立して定義するオブジェクトです。`zIndex` とレイヤー、`parentId`、`label.visible` などの設定に従います。

## 編集したJSONの保存方法

1. マップ閲覧画面のメニューから「現在のマップを編集（JSON）」を開くか、編集画面から直接マップを選択します。
2. 図形を選択し、右側のフォームまたはオブジェクトJSONで設定を変更します。移動モードをONにすると選択済み図形をドラッグできます。
3. **「JSONを保存」でファイルを書き出します。** GitHub Pagesは静的サイトのため、ここからGitHub内のファイルに自動でコミットすることはできません。
4. 書き出されたJSONを `rebuild/scenes/` の対応するファイルへ反映します。ブラウザーでは「JSONを開く」で任意のシーンファイルを読み込めます。

## 検証

```sh
node rebuild/tests/validate-scenes.js
node rebuild/tests/editor-smoke.js
```

既存の施設・道路の座標、親子参照、JSONシーンの形状と表示条件をテストします。ブラウザーでの視覚的な配置・操作確認は、コードテストとは別に行います。

## 制約

- 既存データに登録されていない壁や扉は自動生成しません。
- 側面図は描画用シーン自体を編集可能ですが、元の側面形状データが未登録のため自動では完成しません。
- 古いオートマン専用の配置ツールは `legacy/` に保持し、現行の編集機能は汎用JSON形式に統一します。
