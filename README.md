# Alignment Grid

図形をドラッグして離すと、バネと減衰の動きで最寄りの格子点へスナップする HTML Canvas デモです。

![JavaScript](https://img.shields.io/badge/JavaScript-Node.js%2020+-f7df1e?logo=javascript&logoColor=000)
![Test](https://img.shields.io/badge/test-node%20--test-339933?logo=node.js&logoColor=fff)
![License](https://img.shields.io/badge/license-unlicensed-lightgrey)

## 概要

`index.html` は、外部ライブラリなしで動く単一ファイルのインタラクティブな Canvas アプリです。円、四角形、三角形、ひし形、六角形をドラッグでき、ポインタを離すと 64px 間隔の格子へスナップします。

GitHub Pages で公開しています。

https://nagata-minoru.github.io/alignment-grid/

主な挙動は次のとおりです。

- 図形のドラッグ操作
- 最寄り格子点へのスナップ
- バネ定数 `k=140`、減衰係数 `c=12` の物理挙動
- DPR を考慮した Canvas リサイズ
- Node.js 組み込みテストランナーによるロジックテスト

## デモの実行

ブラウザで次のファイルを開くだけで実行できます。

```text
index.html
```

ローカルサーバーは必須ではありません。ファイルを直接開いて動作します。

## テスト

Node.js 20 以上を想定しています。

```bash
npm test
```

テストでは `alignment-grid.html` のインラインスクリプトを VM 上で読み込み、DOM と Canvas をスタブして検証します。

検証している内容:

- `nearestGrid` が座標を 64px 格子へ丸めること
- `resize` が DPR に合わせて Canvas の実ピクセルサイズを設定すること
- `Shape.pick` の当たり判定
- `Shape.snap` のスナップ先設定
- ドラッグ中の物理更新スキップ
- バネ減衰による目標位置への収束
- ポインタ操作によるドラッグとリリース時のスナップ
- アニメーションループの更新と次フレーム予約

## ファイル構成

```text
.
├── index.html
├── alignment-grid.html
├── package.json
└── test
    └── alignment-grid.test.js
```

## 開発メモ

このプロジェクトはビルド手順を持ちません。アプリ本体は `index.html` に完結しており、`alignment-grid.html` は既存リンク用に同じ内容を残しています。テストだけ Node.js を使用します。

描画や入力処理を変更した場合は、次の観点でテストを追加または更新してください。

- 格子への丸め規則が変わるか
- 図形の当たり判定範囲が変わるか
- ドラッグ開始、移動、解放時の状態遷移が変わるか
- バネや減衰の定数変更で収束条件が変わるか

## ライセンス

現時点ではライセンスファイルはありません。
