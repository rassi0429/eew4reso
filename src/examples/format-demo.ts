import { EEWParser } from '../parser/eew-parser';
import { EEWFormatter } from '../formatter/eew-formatter';
import { hasStandardEEWData } from '../utils/type-guards';
import { EEWData } from '../types/eew';

async function demonstrateFormatting() {
  console.log('=== EEW フォーマットデモ ===\n');

  // Load sample EEW data
  console.log('サンプルEEWデータの読み込み中...');
  
  try {
    const messages = await EEWParser.parseFile('/home/neo/git/eew4reso/body.json');
    console.log(`${messages.length}件のEEWメッセージを読み込みました\n`);

    // Find different types of messages
    const warningMessage = messages.find(m => typeof m.data === 'object' && m.data.isWarning && m.data.earthquake && m.data.intensity);
    const cancelMessage = messages.find(m => typeof m.data === 'object' && m.data.isCanceled);
    const forecastMessage = messages.find(m => typeof m.data === 'object' && !m.data.isWarning && !m.data.isCanceled && m.data.earthquake);

    // Demo 1: Warning message format
    if (warningMessage) {
      console.log('🚨 === 警報メッセージのフォーマット ===');
      console.log(EEWFormatter.formatForMisskey(warningMessage));
      console.log('\n' + '='.repeat(60) + '\n');
      
      console.log('ショートフォーマット:');
      console.log(EEWFormatter.formatShort(warningMessage));
      console.log('\nハッシュタグ:');
      console.log(EEWFormatter.createHashtags(warningMessage).join(' '));
      console.log('\n' + '='.repeat(60) + '\n');
    }

    // Demo 2: Forecast message format
    if (forecastMessage) {
      console.log('📊 === 予報メッセージのフォーマット ===');
      console.log(EEWFormatter.formatForMisskey(forecastMessage));
      console.log('\n' + '='.repeat(60) + '\n');
      
      console.log('ショートフォーマット:');
      console.log(EEWFormatter.formatShort(forecastMessage));
      console.log('\n' + '='.repeat(60) + '\n');
    }

    // Demo 3: Cancellation message format
    if (cancelMessage) {
      console.log('🚫 === 取り消しメッセージのフォーマット ===');
      console.log(EEWFormatter.formatForMisskey(cancelMessage));
      console.log('\n' + '='.repeat(60) + '\n');
      
      console.log('ショートフォーマット:');
      console.log(EEWFormatter.formatShort(cancelMessage));
      console.log('\n' + '='.repeat(60) + '\n');
    }

    // Demo 4: Custom template
    console.log('🎨 === カスタムテンプレートデモ ===\n');
    const templates = [
      {
        name: 'シンプル',
        template: '{emoji} {type} {epicenter} M{magnitude} {intensity}'
      },
      {
        name: '詳細',
        template: '{emoji} **{type}**\n📍 {epicenter}\n📊 M{magnitude} 深さ{depth}km\n⚡ {intensity}\n🕐 {time}'
      },
      {
        name: 'ハッシュタグ付き',
        template: '{emoji} {epicenter} M{magnitude} {intensity}\n{hashtags}'
      }
    ];

    if (warningMessage) {
      templates.forEach(({ name, template }) => {
        console.log(`${name}テンプレート:`);
        console.log(`"${template}"`);
        console.log('\n結果:');
        console.log(EEWFormatter.formatCustom(warningMessage, template));
        console.log('\n' + '-'.repeat(40) + '\n');
      });
    }

    // Demo 5: Severity and emoji demonstration
    console.log('📊 === 重要度とアイコンのデモ ===\n');
    
    const severityDemo = messages
      .filter(m => hasStandardEEWData(m) && m.data.earthquake && m.data.intensity)
      .slice(0, 10)
      .map(m => {
        const data = m.data as EEWData;
        const keyInfo = EEWParser.extractKeyInfo(data);
        const severity = EEWParser.getSeverityLevel(data);
        const emoji = EEWFormatter.getSeverityEmoji(data);
        const intensity = keyInfo.maxIntensity 
          ? EEWParser.formatIntensity(keyInfo.maxIntensity.from, keyInfo.maxIntensity.to)
          : 'N/A';
        
        return {
          emoji,
          epicenter: keyInfo.earthquake?.epicenter.name || 'N/A',
          magnitude: keyInfo.earthquake?.magnitude || 0,
          intensity,
          severity,
          isWarning: data.isWarning
        };
      })
      .sort((a, b) => b.severity - a.severity);

    console.log('重要度順（高→低）:');
    severityDemo.forEach((item, i) => {
      const warningText = item.isWarning ? '警報' : '予報';
      const index = (i + 1).toString().padStart(2, ' ');
      console.log(`${index}. ${item.emoji} ${item.epicenter} M${item.magnitude} ${item.intensity} (${warningText}, 重要度: ${item.severity})`);
    });

    // Demo 6: Statistics
    console.log('\n📈 === 統計情報 ===\n');
    
    const stats = {
      total: messages.length,
      warnings: messages.filter(m => hasStandardEEWData(m) && m.data.isWarning).length,
      cancellations: messages.filter(m => hasStandardEEWData(m) && m.data.isCanceled).length,
      withEarthquake: messages.filter(m => hasStandardEEWData(m) && m.data.earthquake).length,
      withIntensity: messages.filter(m => hasStandardEEWData(m) && m.data.intensity).length,
      highSeverity: messages.filter(m => hasStandardEEWData(m) && EEWParser.getSeverityLevel(m.data) >= 60).length
    };

    console.log(`総メッセージ数: ${stats.total}`);
    console.log(`警報メッセージ: ${stats.warnings} (${(stats.warnings/stats.total*100).toFixed(1)}%)`);
    console.log(`取り消しメッセージ: ${stats.cancellations}`);
    console.log(`地震情報ありメッセージ: ${stats.withEarthquake} (${(stats.withEarthquake/stats.total*100).toFixed(1)}%)`);
    console.log(`震度情報ありメッセージ: ${stats.withIntensity} (${(stats.withIntensity/stats.total*100).toFixed(1)}%)`);
    console.log(`高重要度メッセージ: ${stats.highSeverity} (${(stats.highSeverity/stats.total*100).toFixed(1)}%)`);

    // Demo 7: Real-world usage examples
    console.log('\n💡 === 実用例 ===\n');
    console.log('1. 基本的な使用方法:');
    console.log('```typescript');
    console.log('const message = EEWParser.parseLine(jsonLine);');
    console.log('if (message) {');
    console.log('  const text = EEWFormatter.formatForMisskey(message);');
    console.log('  console.log(text);');
    console.log('}');
    console.log('```\n');

    console.log('2. フィルタリング付きの使用:');
    console.log('```typescript');
    console.log('const messages = await EEWParser.parseFile("data.json");');
    console.log('const importantMessages = messages.filter(m => {');
    console.log('  const severity = EEWParser.getSeverityLevel(m.data);');
    console.log('  return severity >= 50 || m.data.isWarning;');
    console.log('});');
    console.log('');
    console.log('importantMessages.forEach(msg => {');
    console.log('  const text = EEWFormatter.formatForMisskey(msg);');
    console.log('  // Post to Misskey');
    console.log('});');
    console.log('```\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the demo
demonstrateFormatting().catch(console.error);