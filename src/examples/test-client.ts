import axios from 'axios';
import { EEWParser } from '../parser/eew-parser';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3338';

async function testEEWServer() {
  console.log('=== EEW Server テストクライアント ===\n');

  try {
    // Test 1: Health check
    console.log('1. ヘルスチェック...');
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    console.log('✅ サーバーは正常に動作中');
    console.log('   稼働時間:', Math.floor(healthResponse.data.uptime / 1000), '秒\n');

    // Test 2: Load sample data
    console.log('2. サンプルEEWデータの読み込み...');
    const messages = await EEWParser.parseFile('/home/neo/git/eew4reso/body.json');
    console.log(`   ${messages.length}件のEEWメッセージを読み込み\n`);

    // Test 3: Send single EEW message
    console.log('3. 単一EEWメッセージの送信テスト...');
    const warningMessage = messages.find(m => m.data.isWarning && m.data.earthquake && m.data.intensity);
    
    if (warningMessage) {
      const response = await axios.post(`${SERVER_URL}/receive`, warningMessage);
      console.log('✅ 警報メッセージ送信成功');
      console.log('   結果:', response.data.results[0]?.summary);
      console.log('   投稿:', response.data.results[0]?.posted ? 'あり' : 'なし\n');
    }

    // Test 4: Send multiple messages
    console.log('4. 複数EEWメッセージの送信テスト...');
    const testMessages = messages.slice(0, 3);
    const multiResponse = await axios.post(`${SERVER_URL}/receive`, testMessages);
    console.log(`✅ ${multiResponse.data.processed}件のメッセージを処理`);
    multiResponse.data.results.forEach((result: any, i: number) => {
      console.log(`   ${i + 1}. ${result.summary || 'エラー'} (投稿: ${result.posted ? 'あり' : 'なし'})`);
    });
    console.log('');

    // Test 5: Send cancel message
    console.log('5. 取り消しメッセージの送信テスト...');
    const cancelMessage = messages.find(m => m.data.isCanceled);
    
    if (cancelMessage) {
      const response = await axios.post(`${SERVER_URL}/receive`, cancelMessage);
      console.log('✅ 取り消しメッセージ送信成功');
      console.log('   結果:', response.data.results[0]?.summary);
      console.log('   投稿:', response.data.results[0]?.posted ? 'あり' : 'なし\n');
    }

    // Test 6: Get statistics
    console.log('6. サーバー統計の取得...');
    const statsResponse = await axios.get(`${SERVER_URL}/stats`);
    const stats = statsResponse.data;
    console.log('✅ 統計情報:');
    console.log(`   受信総数: ${stats.totalReceived}`);
    console.log(`   処理総数: ${stats.totalProcessed}`);
    console.log(`   投稿総数: ${stats.totalPosted}`);
    console.log(`   エラー数: ${stats.errors}`);
    console.log(`   稼働時間: ${stats.uptime.formatted}\n`);

    // Test 7: Test invalid data
    console.log('7. 無効データの送信テスト...');
    try {
      await axios.post(`${SERVER_URL}/receive`, { invalid: 'data' });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.log('✅ 無効データは正しく拒否されました\n');
      } else {
        throw error;
      }
    }

    // Test 8: Test posting (if configured)
    console.log('8. 投稿機能のテスト...');
    try {
      const testResponse = await axios.post(`${SERVER_URL}/test`);
      if (testResponse.data.success) {
        console.log('✅ テスト投稿成功');
      } else {
        console.log('❌ テスト投稿失敗');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        console.log('📴 投稿サービスが設定されていません');
      } else {
        console.log('❌ テスト投稿エラー:', error instanceof Error ? error.message : String(error));
      }
    }

    console.log('\n🎉 すべてのテストが完了しました！');

  } catch (error) {
    console.error('❌ テストエラー:', error instanceof Error ? error.message : String(error));
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 サーバーが起動していることを確認してください: npm start');
      }
    }
  }
}

// Performance test function
async function performanceTest(messageCount: number = 10) {
  console.log(`\n=== パフォーマンステスト (${messageCount}件) ===`);

  try {
    const messages = await EEWParser.parseFile('/home/neo/git/eew4reso/body.json');
    const testMessages = messages.slice(0, messageCount);

    const startTime = Date.now();
    
    // Send messages in parallel
    const promises = testMessages.map(message => 
      axios.post(`${SERVER_URL}/receive`, message)
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();

    const totalTime = endTime - startTime;
    const avgTime = totalTime / messageCount;

    console.log(`✅ ${messageCount}件のメッセージを ${totalTime}ms で処理`);
    console.log(`   平均処理時間: ${avgTime.toFixed(2)}ms/メッセージ`);
    console.log(`   スループット: ${(messageCount / (totalTime / 1000)).toFixed(2)} メッセージ/秒`);

    const successCount = responses.filter(r => r.data.success).length;
    console.log(`   成功率: ${successCount}/${messageCount} (${(successCount/messageCount*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ パフォーマンステストエラー:', error instanceof Error ? error.message : String(error));
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--performance')) {
    const count = parseInt(args[args.indexOf('--performance') + 1]) || 10;
    await performanceTest(count);
  } else {
    await testEEWServer();
  }

  if (args.includes('--performance')) {
    await performanceTest();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { testEEWServer, performanceTest };