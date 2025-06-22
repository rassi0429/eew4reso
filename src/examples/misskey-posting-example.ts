import * as dotenv from 'dotenv';
import { EEWParser } from '../parser/eew-parser';
import { EEWFormatter } from '../formatter/eew-formatter';
import { EEWPostingService, PostingConfig } from '../services/eew-posting-service';
import { hasStandardEEWData } from '../utils/type-guards';
import { EEWData } from '../types/eew';

// Load environment variables
dotenv.config();

async function demonstrateMisskeyPosting() {
  console.log('=== Misskey投稿デモ ===\n');

  // Check environment variables
  const misskeyHost = process.env.MISSKEY_HOST;
  const misskeyToken = process.env.MISSKEY_TOKEN;

  if (!misskeyHost || !misskeyToken) {
    console.error('Error: MISSKEY_HOST and MISSKEY_TOKEN must be set in .env file');
    console.log('Copy .env.example to .env and fill in your Misskey details');
    return;
  }

  // Create posting service
  const postingService = EEWPostingService.createDefault(misskeyHost, misskeyToken);

  // Test connection
  console.log('Misskey接続テスト中...');
  const connected = await postingService.testConnection();
  
  if (!connected) {
    console.error('❌ Misskeyへの接続に失敗しました');
    return;
  }
  
  console.log('✅ Misskey接続成功\n');

  // Load sample EEW data
  console.log('サンプルEEWデータの読み込み中...');
  
  try {
    const messages = await EEWParser.parseFile('/home/neo/git/eew4reso/body.json');
    console.log(`${messages.length}件のEEWメッセージを読み込みました\n`);

    // Find some interesting messages to demonstrate
    const warningMessage = messages.find(m => hasStandardEEWData(m) && m.data.isWarning);
    const cancelMessage = messages.find(m => hasStandardEEWData(m) && m.data.isCanceled);
    const forecastMessage = messages.find(m => hasStandardEEWData(m) && !m.data.isWarning && !m.data.isCanceled && m.data.earthquake);

    // Demo 1: Format messages
    console.log('=== メッセージフォーマットのデモ ===\n');

    if (warningMessage) {
      console.log('🚨 警報メッセージ:');
      console.log(EEWFormatter.formatForMisskey(warningMessage));
      console.log('\n' + '='.repeat(50) + '\n');
    }

    if (forecastMessage) {
      console.log('📊 予報メッセージ:');
      console.log(EEWFormatter.formatForMisskey(forecastMessage));
      console.log('\n' + '='.repeat(50) + '\n');
    }

    if (cancelMessage) {
      console.log('🚫 取り消しメッセージ:');
      console.log(EEWFormatter.formatForMisskey(cancelMessage));
      console.log('\n' + '='.repeat(50) + '\n');
    }

    // Demo 2: Short format
    console.log('=== ショートフォーマット ===\n');
    messages.slice(0, 5).forEach((msg, i) => {
      console.log(`${i + 1}. ${EEWFormatter.formatShort(msg)}`);
    });
    console.log('\n');

    // Demo 3: Filtering
    console.log('=== フィルタリングデモ ===\n');
    let filteredCount = 0;
    let significantCount = 0;

    for (const message of messages) {
      if (!hasStandardEEWData(message)) continue;
      const severity = EEWParser.getSeverityLevel(message.data);
      const isSignificant = severity >= 50; // High severity

      if (isSignificant) {
        significantCount++;
        console.log(`重要: ${EEWFormatter.formatShort(message)} (severity: ${severity})`);
      }

      // Test if service would post this
      const wouldPost = await postingService.processEEW(message);
      if (wouldPost) {
        filteredCount++;
      }
    }

    console.log(`\n統計:`);
    console.log(`- 総メッセージ数: ${messages.length}`);
    console.log(`- 重要度高メッセージ: ${significantCount}`);
    console.log(`- 投稿対象メッセージ: ${filteredCount}`);

    // Demo 4: Test post (if user confirms)
    console.log('\n=== テスト投稿 ===');
    console.log('実際にテスト投稿を行いますか？ (y/N)');
    
    // For demo purposes, we'll skip the actual posting
    console.log('デモモードのため、実際の投稿はスキップします。');
    console.log('実際に投稿するには、以下のコードを使用してください:');
    console.log('```javascript');
    console.log('const success = await postingService.postTest();');
    console.log('if (success) {');
    console.log('  console.log("テスト投稿成功!");');
    console.log('}');
    console.log('```');

    // Demo 5: Custom template
    console.log('\n=== カスタムテンプレートデモ ===\n');
    const customTemplate = '{emoji} **{type}** {epicenter} M{magnitude}\n🕐 {time}\n{hashtags}';
    
    if (warningMessage) {
      const customFormatted = EEWFormatter.formatCustom(warningMessage, customTemplate);
      console.log('カスタムテンプレート:');
      console.log(customTemplate);
      console.log('\n結果:');
      console.log(customFormatted);
    }

    // Get stats
    const stats = postingService.getStats();
    console.log('\n=== 投稿サービス統計 ===');
    console.log(`投稿回数: ${stats.postCount}`);
    console.log(`キュー内メッセージ: ${stats.queueLength}`);
    console.log(`最後の投稿: ${stats.lastPostTime ? new Date(stats.lastPostTime).toLocaleString('ja-JP') : 'なし'}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Configuration examples
function showConfigurationExamples() {
  console.log('\n=== 設定例 ===\n');

  console.log('1. 警報のみ投稿する設定:');
  console.log('```javascript');
  console.log('const service = EEWPostingService.createWarningsOnly(host, token);');
  console.log('```\n');

  console.log('2. カスタム設定:');
  console.log('```javascript');
  console.log('const config: PostingConfig = {');
  console.log('  misskey: { host, token },');
  console.log('  posting: {');
  console.log('    enabled: true,');
  console.log('    minSeverity: 40,');
  console.log('    onlyWarnings: false,');
  console.log('    visibility: "home",');
  console.log('    useContentWarning: true,');
  console.log('    rateLimitMs: 3000');
  console.log('  },');
  console.log('  filters: {');
  console.log('    minMagnitude: 4.0,');
  console.log('    allowedRegions: ["390", "391"] // 石川県のみ');
  console.log('  }');
  console.log('};');
  console.log('const service = new EEWPostingService(config);');
  console.log('```\n');

  console.log('3. 環境変数での設定:');
  console.log('MISSKEY_HOST=your.misskey.instance');
  console.log('MISSKEY_TOKEN=your_api_token');
  console.log('POSTING_MIN_SEVERITY=50');
  console.log('POSTING_ONLY_WARNINGS=true');
  console.log('FILTER_MIN_MAGNITUDE=5.0');
}

// Run the demo
async function main() {
  await demonstrateMisskeyPosting();
  showConfigurationExamples();
}

if (require.main === module) {
  main().catch(console.error);
}

export { demonstrateMisskeyPosting, showConfigurationExamples };