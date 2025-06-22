import { EEWParser } from '../parser/eew-parser';
import { EEWFormatter } from '../formatter/eew-formatter';
import { hasStandardEEWData } from '../utils/type-guards';
import { EEWData } from '../types/eew';

async function simpleFormatDemo() {
  console.log('=== EEW フォーマット簡単デモ ===\n');

  try {
    // Load sample EEW data
    const messages = await EEWParser.parseFile('/home/neo/git/eew4reso/body.json');
    console.log(`読み込み完了: ${messages.length}件のEEWメッセージ\n`);

    // Find different types of messages
    const warningMessage = messages.find(m => hasStandardEEWData(m) && m.data.isWarning && m.data.earthquake && m.data.intensity);
    const cancelMessage = messages.find(m => hasStandardEEWData(m) && m.data.isCanceled);
    const forecastMessage = messages.find(m => hasStandardEEWData(m) && !m.data.isWarning && !m.data.isCanceled && m.data.earthquake);

    // Demo 1: Warning message
    if (warningMessage) {
      console.log('🚨 警報メッセージの例:');
      console.log('=' .repeat(50));
      console.log(EEWFormatter.formatForMisskey(warningMessage));
      console.log('=' .repeat(50));
      console.log('\nショート版:');
      console.log(EEWFormatter.formatShort(warningMessage));
      console.log('\n');
    }

    // Demo 2: Forecast message
    if (forecastMessage) {
      console.log('📊 予報メッセージの例:');
      console.log('=' .repeat(50));
      console.log(EEWFormatter.formatForMisskey(forecastMessage));
      console.log('=' .repeat(50));
      console.log('\nショート版:');
      console.log(EEWFormatter.formatShort(forecastMessage));
      console.log('\n');
    }

    // Demo 3: Cancel message
    if (cancelMessage) {
      console.log('🚫 取り消しメッセージの例:');
      console.log('=' .repeat(50));
      console.log(EEWFormatter.formatForMisskey(cancelMessage));
      console.log('=' .repeat(50));
      console.log('\n');
    }

    // Demo 4: Custom template
    console.log('🎨 カスタムテンプレートの例:');
    if (warningMessage) {
      const template = '{emoji} {type} {epicenter} M{magnitude} {intensity}';
      console.log('テンプレート: ' + template);
      console.log('結果: ' + EEWFormatter.formatCustom(warningMessage, template));
      console.log('\n');
    }

    // Demo 5: Statistics
    const warnings = messages.filter(m => hasStandardEEWData(m) && m.data.isWarning).length;
    const cancels = messages.filter(m => hasStandardEEWData(m) && m.data.isCanceled).length;
    const withEarthquake = messages.filter(m => hasStandardEEWData(m) && m.data.earthquake).length;

    console.log('📊 統計:');
    console.log('総数:', messages.length);
    console.log('警報:', warnings);
    console.log('取り消し:', cancels);
    console.log('地震情報あり:', withEarthquake);
    console.log('\n');

    console.log('✅ デモ完了!');

  } catch (error) {
    console.error('エラー:', error);
  }
}

simpleFormatDemo().catch(console.error);