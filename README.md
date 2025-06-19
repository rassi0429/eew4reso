# EEW4Reso - 緊急地震速報 Parser & Misskey Bot

緊急地震速報（EEW）データをHTTP経由で受信し、人間にわかりやすい形でMisskeyに投稿するためのNode.js/TypeScriptプロジェクトです。

## 機能

- 🌐 **HTTPサーバー**: ポート3338で`/receive`エンドポイントからEEWデータを受信
- 📊 **EEWデータパーサー**: JSON形式のEEWデータを解析
- 📝 **人間向けフォーマット**: EEWデータを読みやすいテキストに変換
- 🚀 **Misskey投稿**: 自動的にMisskeyインスタンスに投稿
- ⚡ **リアルタイム処理**: 重要度に基づくフィルタリングと投稿
- 📈 **統計とモニタリング**: リアルタイム統計とヘルスチェック
- 🎨 **カスタマイズ**: テンプレート、フィルター、投稿設定のカスタマイズ

## プロジェクト構造

```
eew4reso/
├── src/
│   ├── types/
│   │   └── eew.ts                    # EEWデータのTypeScript型定義
│   ├── parser/
│   │   └── eew-parser.ts             # EEWデータパーサー
│   ├── formatter/
│   │   └── eew-formatter.ts          # 人間向けテキストフォーマッター
│   ├── misskey/
│   │   └── misskey-client.ts         # Misskey APIクライアント
│   ├── services/
│   │   └── eew-posting-service.ts    # EEW投稿サービス
│   ├── server/
│   │   └── eew-server.ts             # HTTPサーバー
│   ├── tests/
│   │   └── parse-all-test.ts         # 包括的テスト
│   └── examples/
│       ├── parser-example.ts         # パーサーの使用例
│       ├── simple-format-demo.ts     # フォーマット例
│       ├── misskey-posting-example.ts # Misskey投稿例
│       └── test-client.ts            # サーバーテストクライアント
├── index.ts                          # メインサーバー起動ファイル
├── docs/
│   └── eew-data-structure.md         # EEWデータ構造の詳細ドキュメント
├── .env.example                      # 環境変数の例
├── package.json
├── tsconfig.json
└── body.json                         # サンプルEEWデータ
```

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してMisskeyの設定を入力

# TypeScriptのビルド
npm run build

# サーバー起動
npm start
# または開発モード
npm run dev:server
```

## 使用方法

### 1. サーバー起動

```bash
# 開発モード
npm run dev:server

# 本番モード
npm run build && npm start
```

サーバーは以下のエンドポイントを提供します：

- `POST /receive` - EEWデータ受信エンドポイント
- `GET /health` - ヘルスチェック
- `GET /stats` - 統計情報
- `POST /test` - Misskey投稿テスト

### 2. EEWデータの送信

```bash
# curlでテスト
curl -X POST http://localhost:3338/receive \
  -H "Content-Type: application/json" \
  -d '{"type":"eew","timestamp":1749919000370,"data":{...}}'

# 複数のメッセージ
curl -X POST http://localhost:3338/receive \
  -H "Content-Type: application/json" \
  -d '[{"type":"eew",...}, {"type":"eew",...}]'
```

### 3. EEWデータのパース

```typescript
import { EEWParser } from './parser/eew-parser';

// 1行のJSONデータをパース
const message = EEWParser.parseLine(jsonLine);

// ファイルから複数のEEWメッセージをパース
const messages = await EEWParser.parseFile('body.json');

// 重要な情報を抽出
const keyInfo = EEWParser.extractKeyInfo(message.data);
```

### 2. 人間向けフォーマット

```typescript
import { EEWFormatter } from './formatter/eew-formatter';

// Misskey投稿用フォーマット
const text = EEWFormatter.formatForMisskey(message);

// ショートフォーマット
const short = EEWFormatter.formatShort(message);

// カスタムテンプレート
const custom = EEWFormatter.formatCustom(message, '{emoji} {epicenter} M{magnitude}');
```

### 4. Misskey投稿

```typescript
import { EEWPostingService } from './services/eew-posting-service';

// デフォルト設定でサービス作成
const service = EEWPostingService.createDefault('misskey.example.com', 'your_token');

// EEWメッセージの処理と投稿
await service.processEEW(message);

// テスト投稿
await service.postTest();
```

## 実行例

```bash
# サーバー起動
npm run dev:server

# サーバーテスト
npm run dev:test-client

# パーサーデモ
npm run dev

# フォーマットデモ
npx ts-node src/examples/simple-format-demo.ts

# Misskey投稿デモ（要：環境変数設定）
npm run dev:misskey

# 全データのパーステスト
npm run test:parse

# Jestテスト
npm test
```

## API エンドポイント

### POST /receive
EEWデータを受信して処理します。

**Request Body:**
```json
{
  "type": "eew",
  "timestamp": 1749919000370,
  "data": {
    "isLastInfo": false,
    "isCanceled": false,
    "isWarning": true,
    // ... EEWデータ
  }
}
```

**Response:**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "timestamp": 1749919000370,
      "type": "warning",
      "posted": true,
      "summary": "🚨警報 能登半島沖 M5.7 震度5-"
    }
  ]
}
```

### GET /health
サーバーの健康状態を取得します。

**Response:**
```json
{
  "status": "ok",
  "uptime": 158234,
  "stats": {
    "totalReceived": 42,
    "totalProcessed": 85,
    "totalPosted": 12,
    "errors": 0
  },
  "posting": {
    "enabled": true,
    "connected": true
  }
}
```

### GET /stats
詳細な統計情報を取得します。

### POST /test
Misskey投稿機能をテストします。

## 出力例

### 警報メッセージ
```
🚨 **緊急地震速報（警報）**

📍 **震源地**: 能登半島沖
📊 **マグニチュード**: M5.7
📏 **深さ**: 10km
🌊 **陸海**: 海域

⚡ **最大予想震度**: 震度5-

🔴 **警報対象地域**:
　• 石川県能登: 震度5- (既に主要動到達と推測)

⚠️ 強い揺れに警戒してください。

🕐 **発生時刻**: 2024/1/1 16:10:07
⏰ **情報時刻**: 2025/6/15 1:36:40

📄 続報あり
```

### 予報メッセージ
```
📊 **緊急地震速報（予報）**

📍 **震源地**: 新島・神津島近海
📊 **マグニチュード**: M5.8
📏 **深さ**: 10km
🌊 **陸海**: 海域

🕐 **発生時刻**: 2024/1/1 16:11:23
⏰ **情報時刻**: 2025/6/15 1:38:02

📄 続報あり
```

## 設定

### 環境変数

```bash
# Misskey設定
MISSKEY_HOST=your.misskey.instance
MISSKEY_TOKEN=your_api_token

# 投稿設定
POSTING_ENABLED=true
POSTING_MIN_SEVERITY=30
POSTING_ONLY_WARNINGS=false
POSTING_VISIBILITY=public

# フィルタ設定
FILTER_MIN_MAGNITUDE=3.0
FILTER_MAX_DEPTH=700
```

### カスタム設定例

```typescript
const config = {
  posting: {
    enabled: true,
    minSeverity: 50,
    onlyWarnings: true,
    visibility: 'home',
    useContentWarning: true,
    rateLimitMs: 2000
  },
  filters: {
    minMagnitude: 4.0,
    allowedRegions: ['390', '391'] // 石川県のみ
  }
};
```

## 主な機能

### パーサー
- 改行区切りJSON形式のEEWデータを解析
- 3つの異なるEEW形式に対応（完全版・基本版・取り消し版）
- 重要情報の抽出と構造化
- 重要度評価とフィルタリング

### フォーマッター
- 人間にわかりやすいテキスト変換
- Misskey投稿用フォーマット
- カスタムテンプレート対応
- 重要度別の絵文字表示

### 投稿サービス
- 自動フィルタリング
- レート制限対応
- 重要な更新の検知
- エラーハンドリングとリトライ

## テスト

すべてのbody.jsonエントリ（99件）が100%正常にパースできることを確認済みです。

```bash
npm test        # Jestテスト
npm run test:parse  # 全データパーステスト
```

## データ構造

詳細なEEWデータ構造については[docs/eew-data-structure.md](docs/eew-data-structure.md)を参照してください。

## ライセンス

MIT