import { EEWParser } from '../parser/eew-parser';
import { EEWMessage } from '../types/eew';
import { JSTDate, setupTimezone } from '../utils/timezone';

// 日本時間に設定
setupTimezone();

// Example: Parse a single EEW message
const exampleLine = `{"type":"eew","timestamp":1749919000370,"data":{"isLastInfo":false,"isCanceled":false,"isWarning":true,"zones":[{"kind":{"lastKind":{"code":"31","name":"緊急地震速報（警報）"},"code":"31","name":"緊急地震速報（警報）"},"code":"9934","name":"北陸"}],"prefectures":[{"kind":{"lastKind":{"code":"31","name":"緊急地震速報（警報）"},"code":"31","name":"緊急地震速報（警報）"},"code":"9170","name":"石川"}],"regions":[{"kind":{"lastKind":{"code":"31","name":"緊急地震速報（警報）"},"code":"31","name":"緊急地震速報（警報）"},"code":"390","name":"石川県能登"}],"earthquake":{"originTime":"2024-01-01T16:10:07+09:00","arrivalTime":"2024-01-01T16:10:10+09:00","hypocenter":{"coordinate":{"latitude":{"text":"37.6˚N","value":"37.6000"},"longitude":{"text":"137.3˚E","value":"137.3000"},"height":{"type":"高さ","unit":"m","value":"-10000"},"geodeticSystem":"日本測地系"},"depth":{"type":"深さ","unit":"km","value":"10"},"reduce":{"code":"9777","name":"能登半島沖"},"landOrSea":"海域","accuracy":{"epicenters":["3","3"],"depth":"3","magnitudeCalculation":"5","numberOfMagnitudeCalculation":"1"},"code":"495","name":"能登半島沖"},"magnitude":{"type":"マグニチュード","unit":"Mj","value":"5.7"}},"intensity":{"forecastMaxInt":{"from":"5-","to":"5-"},"forecastMaxLgInt":{"from":"1","to":"1"},"appendix":{"maxIntChange":"0","maxLgIntChange":"0","maxIntChangeReason":"0"},"regions":[{"condition":"既に主要動到達と推測","forecastMaxInt":{"from":"5-","to":"5-"},"forecastMaxLgInt":{"from":"1","to":"1"},"isPlum":false,"isWarning":true,"kind":{"code":"11","name":"緊急地震速報（警報）"},"code":"390","name":"石川県能登"}]},"comments":{"warning":{"text":"強い揺れに警戒してください。","codes":["0201"]}}}}`;

async function demonstrateParser() {
  console.log('=== EEW Parser Example ===\n');

  // Parse single line
  const message = EEWParser.parseLine(exampleLine);
  if (message) {
    console.log('Parsed EEW Message:');
    console.log(`- Type: ${message.type}`);
    console.log(`- Timestamp: ${new Date(message.timestamp).toLocaleString('ja-JP')}`);
    console.log('');

    // Extract key information
    const keyInfo = EEWParser.extractKeyInfo(message.data);
    
    console.log('Key Information:');
    console.log(`- Warning: ${keyInfo.isWarning ? 'Yes' : 'No'}`);
    console.log(`- Canceled: ${keyInfo.isCanceled ? 'Yes' : 'No'}`);
    console.log(`- Final Report: ${keyInfo.isLastInfo ? 'Yes' : 'No'}`);
    console.log('');
    
    if (keyInfo.earthquake) {
      console.log('Earthquake Details:');
      console.log(`- Origin Time: ${JSTDate.toJSTString(keyInfo.earthquake.originTime)}`);
      console.log(`- Magnitude: M${keyInfo.earthquake.magnitude}`);
      console.log(`- Depth: ${keyInfo.earthquake.depth}km`);
      console.log(`- Epicenter: ${keyInfo.earthquake.epicenter.name}`);
      console.log(`- Location: ${keyInfo.earthquake.epicenter.lat}°N, ${keyInfo.earthquake.epicenter.lon}°E`);
      console.log(`- Land/Sea: ${keyInfo.earthquake.epicenter.landOrSea}`);
      console.log('');
    }
    
    if (keyInfo.maxIntensity) {
      console.log('Intensity Information:');
      console.log(`- Maximum: ${EEWParser.formatIntensity(keyInfo.maxIntensity.from, keyInfo.maxIntensity.to)}`);
      console.log('');
    }
    
    if (keyInfo.warningRegions.length > 0) {
      console.log('Warning Regions:');
      keyInfo.warningRegions.forEach(region => {
        const intensity = EEWParser.formatIntensity(region.intensity.from, region.intensity.to);
        console.log(`- ${region.name}: ${intensity}`);
        if (region.condition) {
          console.log(`  (${region.condition})`);
        }
      });
      console.log('');
    }
    
    if (keyInfo.warningMessage) {
      console.log(`Warning Message: ${keyInfo.warningMessage}`);
      console.log('');
    }
    
    console.log(`Severity Level: ${EEWParser.getSeverityLevel(message.data)}`);
  }

  // Example: Parse multiple messages from file
  console.log('\n=== Parsing from file ===');
  try {
    const messages = await EEWParser.parseFile('/home/neo/git/eew4reso/body.json');
    console.log(`Total messages parsed: ${messages.length}`);
    
    // Find most severe earthquake
    let mostSevere: EEWMessage | null = null;
    let highestSeverity = 0;
    
    for (const msg of messages) {
      const severity = EEWParser.getSeverityLevel(msg.data);
      if (severity > highestSeverity) {
        highestSeverity = severity;
        mostSevere = msg;
      }
    }
    
    if (mostSevere) {
      const info = EEWParser.extractKeyInfo(mostSevere.data);
      console.log(`\nMost severe earthquake:`);
      if (info.earthquake) {
        console.log(`- Magnitude: M${info.earthquake.magnitude}`);
        console.log(`- Epicenter: ${info.earthquake.epicenter.name}`);
        console.log(`- Time: ${JSTDate.toJSTString(info.earthquake.originTime)}`);
      }
      if (info.maxIntensity) {
        console.log(`- Maximum Intensity: ${EEWParser.formatIntensity(info.maxIntensity.from, info.maxIntensity.to)}`);
      }
    }
    
    // Check for significant updates
    console.log('\n=== Checking for significant updates ===');
    let previousData: any = null;
    let updateCount = 0;
    
    for (let i = 0; i < Math.min(10, messages.length); i++) {
      const msg = messages[i];
      if (EEWParser.isSignificantUpdate(msg.data, previousData)) {
        updateCount++;
        console.log(`Update #${updateCount} at ${JSTDate.toJSTTimeString(msg.timestamp)}:`);
        const info = EEWParser.extractKeyInfo(msg.data);
        const magnitude = info.earthquake ? `M${info.earthquake.magnitude}` : 'N/A';
        const intensity = info.maxIntensity ? EEWParser.formatIntensity(info.maxIntensity.from, info.maxIntensity.to) : 'N/A';
        console.log(`  - ${magnitude}, Max: ${intensity}`);
      }
      previousData = msg.data;
    }
    
  } catch (error) {
    console.error('Error parsing file:', error);
  }
}

// Run the example
demonstrateParser().catch(console.error);