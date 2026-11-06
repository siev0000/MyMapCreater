# AA 中層 20×20 MAP（GitHub Pages版）

Notionに記載されたアポクリファ＝アーカイブの中層施設・交通網を20×20のマスで視覚化した試作HTMLです。

- 船首は上（+X）、右舷は右（+Y）。
- 地図の表示範囲：X ±2,000m、Y ±1,250m。縦横比は8:5。
- 1マス：X方向200m × Y方向125m。
- 施設の中心点はNotionの位置座標に基づきます。未確定の取付道路は描いていません。
- 単独HTMLのためビルド・外部ライブラリ不要です。

## GitHub Pagesで見る方法

1. GitHubリポジトリを作り、`index.html` をルートにアップロードする。
2. リポジトリの Settings → Pages で、Build and deployment を `Deploy from a branch` にする。
3. Branch を `main`、Folder を `/(root)` に選択して保存する。
4. GitHubが表示する Pages のURLで開く。

プライベートに運用したい場合は、Pages の公開範囲をリポジトリと別に確認してください。公開設定ではマップ内容が一般公開される場合があります。
