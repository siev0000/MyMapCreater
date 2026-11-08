# MyMapCreater 仕様書目次

最終整理: 2026-11-08

このフォルダは**汎用マップ作成・描画アプリ**の機能仕様を項目別に管理する。世界、船、町、建物、施設のいずれにも通用する仕様にし、個別地名・施設IDでアプリの処理を分岐させない。

## 参照の優先順位

1. 動作済みの実装・現行シーン形式: `../../rebuild/map-viewer.js`, `../../rebuild/map-editor.js`, `../../rebuild/SCENE_FORMAT_v2.md`
2. このフォルダの**目標仕様**（現行実装と異なる場合は「未実装」として扱う）
3. `../map-engine-rebuild-spec-2026-11-08.md` 等の旧検討記録（歴史資料。現行の実装完了を意味しない）

実際のマップ内容は `../../rebuild/scenes/*.scene.json`、保護する元配置は `../../data/*-layout-draft.json`。仕様書に書いた機能を、実装済みと誤認しない。

## 分割した仕様書

| ファイル | 対象 |
|---|---|
| [01-architecture.md](01-architecture.md) | 汎用アーキテクチャ、地図/シーン/オブジェクトの区別 |
| [02-hierarchy-and-visibility.md](02-hierarchy-and-visibility.md) | 数値表示Lv、親子関係、選択、展開、ラベル |
| [03-geometry-and-editing.md](03-geometry-and-editing.md) | 図形、座標、描画、直接編集、スナップ |
| [04-walls-doors-and-connections.md](04-walls-doors-and-connections.md) | 壁、扉、開口、道路、接続 |
| [05-data-and-validation.md](05-data-and-validation.md) | JSON形式、入出力、互換、検証 |
| [06-roadmap-and-acceptance.md](06-roadmap-and-acceptance.md) | 施設内部までの必須機能・優先順位・受け入れ条件 |

## 目標範囲

1つのシーン内で **全体区画 → 地区 → 施設 → 施設内部の部屋/小区画 → 設備・詳細** を作図・閲覧・編集できることを主要目標にする。ただし5段階に固定しない。階層の深さは任意とし、どの段階にも壁・扉・経路・注記を配置できる。

- **現行実装**: Scene v2、`level` の large/medium/small 等、図形追加・移動・数値編集・親ID・JSON入出力。
- **採用する次期設計**: 数値の `displayLevel`、任意深度の階層ツリー、詳細な作図・部屋・壁扉編集。
- **未実装**: 完全な数値Lv移行、頂点ハンドル、壁の開口連動、通行・接続判定、GitHubへのブラウザー直接保存。

## 配置保護

既存の図形座標・色・輪郭・施設寸法・元JSONは、明示的な配置修正の承認なしに変更しない。**見た目の重なりはまず階層・透明度・表示条件で解消**し、勝手に別の図形へ裁断しない。仕様の採用と実装・配置データの変更は別工程。
