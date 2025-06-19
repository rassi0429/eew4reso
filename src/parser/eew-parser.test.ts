import { EEWParser } from './eew-parser';
import { EEWMessage } from '../types/eew';
import * as fs from 'fs';
import * as path from 'path';

describe('EEWParser', () => {
  const sampleEEWLine = `{"type":"eew","timestamp":1749919000370,"data":{"isLastInfo":false,"isCanceled":false,"isWarning":true,"zones":[{"kind":{"lastKind":{"code":"31","name":"緊急地震速報（警報）"},"code":"31","name":"緊急地震速報（警報）"},"code":"9934","name":"北陸"}],"prefectures":[{"kind":{"lastKind":{"code":"31","name":"緊急地震速報（警報）"},"code":"31","name":"緊急地震速報（警報）"},"code":"9170","name":"石川"}],"regions":[{"kind":{"lastKind":{"code":"31","name":"緊急地震速報（警報）"},"code":"31","name":"緊急地震速報（警報）"},"code":"390","name":"石川県能登"}],"earthquake":{"originTime":"2024-01-01T16:10:07+09:00","arrivalTime":"2024-01-01T16:10:10+09:00","hypocenter":{"coordinate":{"latitude":{"text":"37.6˚N","value":"37.6000"},"longitude":{"text":"137.3˚E","value":"137.3000"},"height":{"type":"高さ","unit":"m","value":"-10000"},"geodeticSystem":"日本測地系"},"depth":{"type":"深さ","unit":"km","value":"10"},"reduce":{"code":"9777","name":"能登半島沖"},"landOrSea":"海域","accuracy":{"epicenters":["3","3"],"depth":"3","magnitudeCalculation":"5","numberOfMagnitudeCalculation":"1"},"code":"495","name":"能登半島沖"},"magnitude":{"type":"マグニチュード","unit":"Mj","value":"5.7"}},"intensity":{"forecastMaxInt":{"from":"5-","to":"5-"},"forecastMaxLgInt":{"from":"1","to":"1"},"appendix":{"maxIntChange":"0","maxLgIntChange":"0","maxIntChangeReason":"0"},"regions":[{"condition":"既に主要動到達と推測","forecastMaxInt":{"from":"5-","to":"5-"},"forecastMaxLgInt":{"from":"1","to":"1"},"isPlum":false,"isWarning":true,"kind":{"code":"11","name":"緊急地震速報（警報）"},"code":"390","name":"石川県能登"}]},"comments":{"warning":{"text":"強い揺れに警戒してください。","codes":["0201"]}}}}`;

  describe('parseLine', () => {
    it('should parse a valid EEW line', () => {
      const result = EEWParser.parseLine(sampleEEWLine);
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('eew');
      expect(result?.timestamp).toBe(1749919000370);
      expect(result?.data).toBeDefined();
      expect(result?.data.isWarning).toBe(true);
      expect(result?.data.earthquake?.magnitude.value).toBe('5.7');
    });

    it('should return null for empty line', () => {
      const result = EEWParser.parseLine('');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = EEWParser.parseLine('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for JSON without required fields', () => {
      const result = EEWParser.parseLine('{"invalid": "data"}');
      expect(result).toBeNull();
    });
  });

  describe('parseString', () => {
    it('should parse multiple lines', () => {
      const multiLine = `${sampleEEWLine}\n${sampleEEWLine}`;
      const result = EEWParser.parseString(multiLine);
      
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('eew');
      expect(result[1].type).toBe('eew');
    });

    it('should handle empty lines', () => {
      const multiLine = `${sampleEEWLine}\n\n${sampleEEWLine}\n`;
      const result = EEWParser.parseString(multiLine);
      
      expect(result).toHaveLength(2);
    });
  });

  describe('extractKeyInfo', () => {
    it('should extract key information correctly', () => {
      const message = EEWParser.parseLine(sampleEEWLine);
      expect(message).not.toBeNull();
      
      const keyInfo = EEWParser.extractKeyInfo(message!.data);
      
      expect(keyInfo.isWarning).toBe(true);
      expect(keyInfo.isCanceled).toBe(false);
      expect(keyInfo.earthquake?.magnitude).toBe(5.7);
      expect(keyInfo.earthquake?.depth).toBe(10);
      expect(keyInfo.earthquake?.epicenter.name).toBe('能登半島沖');
      expect(keyInfo.earthquake?.epicenter.landOrSea).toBe('海域');
      expect(keyInfo.maxIntensity?.from).toBe('5-');
      expect(keyInfo.maxIntensity?.to).toBe('5-');
      expect(keyInfo.warningRegions).toHaveLength(1);
      expect(keyInfo.warningRegions[0].name).toBe('石川県能登');
    });
  });

  describe('isSignificantUpdate', () => {
    it('should return true for first update', () => {
      const message = EEWParser.parseLine(sampleEEWLine);
      const isSignificant = EEWParser.isSignificantUpdate(message!.data, null);
      expect(isSignificant).toBe(true);
    });

    it('should detect magnitude changes', () => {
      const message1 = EEWParser.parseLine(sampleEEWLine);
      const message2JSON = JSON.parse(sampleEEWLine);
      message2JSON.data.earthquake.magnitude.value = '6.0';
      
      const isSignificant = EEWParser.isSignificantUpdate(
        message2JSON.data,
        message1!.data
      );
      expect(isSignificant).toBe(true);
    });

    it('should detect intensity changes', () => {
      const message1 = EEWParser.parseLine(sampleEEWLine);
      const message2JSON = JSON.parse(sampleEEWLine);
      message2JSON.data.intensity.forecastMaxInt.to = '6-';
      
      const isSignificant = EEWParser.isSignificantUpdate(
        message2JSON.data,
        message1!.data
      );
      expect(isSignificant).toBe(true);
    });
  });

  describe('formatIntensity', () => {
    it('should format same intensity', () => {
      const result = EEWParser.formatIntensity('5-', '5-');
      expect(result).toBe('震度5-');
    });

    it('should format intensity range', () => {
      const result = EEWParser.formatIntensity('5-', '6+');
      expect(result).toBe('震度5-〜6+');
    });
  });

  describe('getSeverityLevel', () => {
    it('should return 0 for canceled EEW', () => {
      const message = EEWParser.parseLine(sampleEEWLine);
      message!.data.isCanceled = true;
      
      const severity = EEWParser.getSeverityLevel(message!.data);
      expect(severity).toBe(0);
    });

    it('should calculate severity based on intensity and magnitude', () => {
      const message = EEWParser.parseLine(sampleEEWLine);
      const severity = EEWParser.getSeverityLevel(message!.data);
      
      // Intensity 5- = 5 * 10 + magnitude 5.7 = 55.7
      expect(severity).toBeCloseTo(55.7, 1);
    });
  });

  describe('Parse all body.json entries', () => {
    it('should parse all entries in body.json without errors', async () => {
      const filePath = path.join(__dirname, '../../body.json');
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn('body.json not found, skipping comprehensive test');
        return;
      }

      let totalLines = 0;
      let successfulParses = 0;
      let failedParses = 0;
      const errors: string[] = [];

      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      totalLines = lines.length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
          const message = EEWParser.parseLine(line);
          if (message) {
            successfulParses++;
            
            // Validate basic structure
            expect(message.type).toBe('eew');
            expect(typeof message.timestamp).toBe('number');
            expect(message.data).toBeDefined();
            expect(typeof message.data.isWarning).toBe('boolean');
            expect(typeof message.data.isCanceled).toBe('boolean');
            expect(typeof message.data.isLastInfo).toBe('boolean');
            
            // Optional fields validation - only if they exist
            if (message.data.zones) {
              expect(Array.isArray(message.data.zones)).toBe(true);
            }
            if (message.data.prefectures) {
              expect(Array.isArray(message.data.prefectures)).toBe(true);
            }
            if (message.data.regions) {
              expect(Array.isArray(message.data.regions)).toBe(true);
            }
            if (message.data.earthquake) {
              expect(message.data.earthquake.originTime).toBeDefined();
              expect(message.data.earthquake.magnitude).toBeDefined();
              expect(message.data.earthquake.hypocenter).toBeDefined();
            }
            if (message.data.intensity) {
              expect(message.data.intensity.forecastMaxInt).toBeDefined();
              expect(Array.isArray(message.data.intensity.regions)).toBe(true);
            }
            
          } else {
            failedParses++;
            errors.push(`Line ${i + 1}: Parser returned null`);
          }
        } catch (error) {
          failedParses++;
          errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log(`\nParse results:`);
      console.log(`Total lines: ${totalLines}`);
      console.log(`Successful: ${successfulParses} (${(successfulParses / totalLines * 100).toFixed(2)}%)`);
      console.log(`Failed: ${failedParses} (${(failedParses / totalLines * 100).toFixed(2)}%)`);

      if (errors.length > 0) {
        console.log('\nFirst 5 errors:');
        errors.slice(0, 5).forEach(error => console.log(`  ${error}`));
      }

      // Expect 100% success rate
      expect(failedParses).toBe(0);
      expect(successfulParses).toBe(totalLines);
    }, 30000); // 30 second timeout for large file
  });
});