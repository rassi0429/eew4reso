import { EEWParser } from '../parser/eew-parser';
import { EEWMessage, EEWData } from '../types/eew';
import * as fs from 'fs';
import * as path from 'path';

interface ParseResult {
  totalLines: number;
  successfulParses: number;
  failedParses: number;
  errors: Array<{
    lineNumber: number;
    error: string;
    line: string;
  }>;
  statistics: {
    warningCount: number;
    canceledCount: number;
    lastInfoCount: number;
    uniqueEarthquakes: Map<string, {
      count: number;
      maxMagnitude: number;
      minMagnitude: number;
      regions: Set<string>;
    }>;
    intensityDistribution: Map<string, number>;
    landSeaDistribution: { land: number; sea: number };
  };
}

async function testParseAllEntries(): Promise<ParseResult> {
  const filePath = path.join(__dirname, '../../body.json');
  const result: ParseResult = {
    totalLines: 0,
    successfulParses: 0,
    failedParses: 0,
    errors: [],
    statistics: {
      warningCount: 0,
      canceledCount: 0,
      lastInfoCount: 0,
      uniqueEarthquakes: new Map(),
      intensityDistribution: new Map(),
      landSeaDistribution: { land: 0, sea: 0 }
    }
  };

  console.log('=== EEW Parse All Test ===\n');
  console.log(`Testing file: ${filePath}\n`);

  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    
    result.totalLines = lines.filter(line => line.trim()).length;
    
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      
      const lineNumber = index + 1;
      
      try {
        const message = EEWParser.parseLine(line);
        
        if (message) {
          result.successfulParses++;
          analyzeMessage(message, result.statistics);
        } else {
          result.failedParses++;
          result.errors.push({
            lineNumber,
            error: 'Parser returned null',
            line: line.substring(0, 100) + '...'
          });
        }
      } catch (error) {
        result.failedParses++;
        result.errors.push({
          lineNumber,
          error: error instanceof Error ? error.message : String(error),
          line: line.substring(0, 100) + '...'
        });
      }
      
      // Progress indicator
      if (lineNumber % 100 === 0) {
        process.stdout.write(`\rProcessed ${lineNumber} lines...`);
      }
    });
    
    console.log(`\rProcessed ${result.totalLines} lines.`);
    
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }

  return result;
}

function analyzeMessage(message: EEWMessage, stats: ParseResult['statistics']) {
  const data = message.data;
  
  // Count warnings, cancellations, and final reports
  if (data.isWarning) stats.warningCount++;
  if (data.isCanceled) stats.canceledCount++;
  if (data.isLastInfo) stats.lastInfoCount++;
  
  // Only analyze earthquake data if it exists
  if (data.earthquake) {
    // Track unique earthquakes by origin time
    const originTime = data.earthquake.originTime;
    const earthquakeKey = originTime;
    
    if (!stats.uniqueEarthquakes.has(earthquakeKey)) {
      stats.uniqueEarthquakes.set(earthquakeKey, {
        count: 0,
        maxMagnitude: 0,
        minMagnitude: 999,
        regions: new Set()
      });
    }
    
    const quakeInfo = stats.uniqueEarthquakes.get(earthquakeKey)!;
    quakeInfo.count++;
    
    const magnitude = parseFloat(data.earthquake.magnitude.value);
    quakeInfo.maxMagnitude = Math.max(quakeInfo.maxMagnitude, magnitude);
    quakeInfo.minMagnitude = Math.min(quakeInfo.minMagnitude, magnitude);
    
    // Add affected regions if they exist
    data.regions?.forEach(region => {
      quakeInfo.regions.add(region.name);
    });
    
    // Track land/sea distribution
    if (data.earthquake.hypocenter.landOrSea === '内陸') {
      stats.landSeaDistribution.land++;
    } else {
      stats.landSeaDistribution.sea++;
    }
  }
  
  // Track intensity distribution if intensity data exists
  if (data.intensity) {
    const maxIntensity = data.intensity.forecastMaxInt.to;
    stats.intensityDistribution.set(
      maxIntensity,
      (stats.intensityDistribution.get(maxIntensity) || 0) + 1
    );
  }
}

function printResults(result: ParseResult) {
  console.log('\n=== Parse Results ===');
  console.log(`Total lines: ${result.totalLines}`);
  console.log(`Successful: ${result.successfulParses} (${(result.successfulParses / result.totalLines * 100).toFixed(2)}%)`);
  console.log(`Failed: ${result.failedParses} (${(result.failedParses / result.totalLines * 100).toFixed(2)}%)`);
  
  if (result.errors.length > 0) {
    console.log('\n=== Parse Errors ===');
    console.log(`Found ${result.errors.length} errors:`);
    result.errors.slice(0, 10).forEach(err => {
      console.log(`Line ${err.lineNumber}: ${err.error}`);
      console.log(`  Content: ${err.line}`);
    });
    if (result.errors.length > 10) {
      console.log(`... and ${result.errors.length - 10} more errors`);
    }
  }
  
  console.log('\n=== Statistics ===');
  console.log(`Warning messages: ${result.statistics.warningCount}`);
  console.log(`Canceled messages: ${result.statistics.canceledCount}`);
  console.log(`Final reports: ${result.statistics.lastInfoCount}`);
  console.log(`Unique earthquakes: ${result.statistics.uniqueEarthquakes.size}`);
  
  console.log('\n=== Earthquake Distribution ===');
  let earthquakesByMagnitude: Array<[string, any]> = Array.from(result.statistics.uniqueEarthquakes.entries());
  earthquakesByMagnitude.sort((a, b) => b[1].maxMagnitude - a[1].maxMagnitude);
  
  earthquakesByMagnitude.slice(0, 5).forEach(([time, info]) => {
    const date = new Date(time);
    console.log(`${date.toLocaleString('ja-JP')}:`);
    console.log(`  Updates: ${info.count}`);
    console.log(`  Magnitude: ${info.minMagnitude} - ${info.maxMagnitude}`);
    console.log(`  Affected regions: ${info.regions.size}`);
  });
  
  console.log('\n=== Intensity Distribution ===');
  const intensityOrder = ['2', '3', '4', '5-', '5+', '6-', '6+', '7'];
  intensityOrder.forEach(intensity => {
    const count = result.statistics.intensityDistribution.get(intensity) || 0;
    if (count > 0) {
      const percentage = (count / result.successfulParses * 100).toFixed(2);
      console.log(`震度${intensity}: ${count} (${percentage}%)`);
    }
  });
  
  console.log('\n=== Epicenter Distribution ===');
  const total = result.statistics.landSeaDistribution.land + result.statistics.landSeaDistribution.sea;
  console.log(`内陸: ${result.statistics.landSeaDistribution.land} (${(result.statistics.landSeaDistribution.land / total * 100).toFixed(2)}%)`);
  console.log(`海域: ${result.statistics.landSeaDistribution.sea} (${(result.statistics.landSeaDistribution.sea / total * 100).toFixed(2)}%)`);
}

// Validate data structure
function validateDataStructure(message: EEWMessage): string[] {
  const errors: string[] = [];
  
  // Check required fields
  if (!message.type || message.type !== 'eew') {
    errors.push('Invalid message type');
  }
  
  if (!message.timestamp || typeof message.timestamp !== 'number') {
    errors.push('Invalid or missing timestamp');
  }
  
  if (!message.data) {
    errors.push('Missing data field');
    return errors;
  }
  
  const data = message.data;
  
  // Check boolean fields
  if (typeof data.isLastInfo !== 'boolean') errors.push('isLastInfo is not boolean');
  if (typeof data.isCanceled !== 'boolean') errors.push('isCanceled is not boolean');
  if (typeof data.isWarning !== 'boolean') errors.push('isWarning is not boolean');
  
  // Check arrays
  if (!Array.isArray(data.zones)) errors.push('zones is not an array');
  if (!Array.isArray(data.prefectures)) errors.push('prefectures is not an array');
  if (!Array.isArray(data.regions)) errors.push('regions is not an array');
  
  // Check earthquake data
  if (!data.earthquake) {
    errors.push('Missing earthquake data');
  } else {
    if (!data.earthquake.originTime) errors.push('Missing originTime');
    if (!data.earthquake.hypocenter) errors.push('Missing hypocenter');
    if (!data.earthquake.magnitude) errors.push('Missing magnitude');
  }
  
  // Check intensity data
  if (!data.intensity) {
    errors.push('Missing intensity data');
  } else {
    if (!data.intensity.forecastMaxInt) errors.push('Missing forecastMaxInt');
    if (!data.intensity.regions || !Array.isArray(data.intensity.regions)) {
      errors.push('Missing or invalid intensity regions');
    }
  }
  
  return errors;
}

// Run the test
async function main() {
  try {
    const result = await testParseAllEntries();
    printResults(result);
    
    if (result.failedParses === 0) {
      console.log('\n✅ All entries parsed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Some entries failed to parse.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();