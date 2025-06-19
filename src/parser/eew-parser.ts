import { EEWMessage, EEWData } from '../types/eew';
import { JSTDate } from '../utils/timezone';
import * as fs from 'fs';
import * as readline from 'readline';

export class EEWParser {
  /**
   * Parse a single line of EEW JSON data
   */
  static parseLine(line: string): EEWMessage | null {
    try {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        return null;
      }
      
      const data = JSON.parse(trimmedLine);
      
      // Validate basic structure
      if (data.type !== 'eew' || !data.timestamp || !data.data) {
        console.error('Invalid EEW message structure:', data);
        return null;
      }
      
      return data as EEWMessage;
    } catch (error) {
      console.error('Failed to parse EEW line:', error);
      return null;
    }
  }

  /**
   * Parse EEW data from a file with newline-separated JSON
   */
  static async parseFile(filePath: string): Promise<EEWMessage[]> {
    const messages: EEWMessage[] = [];
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const message = this.parseLine(line);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Parse EEW data from a string containing multiple newline-separated JSON objects
   */
  static parseString(data: string): EEWMessage[] {
    const lines = data.split('\n');
    const messages: EEWMessage[] = [];

    for (const line of lines) {
      const message = this.parseLine(line);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Extract key information from EEW data for quick access
   */
  static extractKeyInfo(eewData: EEWData) {
    return {
      isWarning: eewData.isWarning,
      isCanceled: eewData.isCanceled,
      isLastInfo: eewData.isLastInfo,
      
      // Handle cancellation messages
      cancelText: eewData.text,
      
      earthquake: eewData.earthquake ? {
        originTime: new Date(eewData.earthquake.originTime),
        magnitude: parseFloat(eewData.earthquake.magnitude.value),
        depth: parseInt(eewData.earthquake.hypocenter.depth.value),
        epicenter: {
          name: eewData.earthquake.hypocenter.name,
          lat: parseFloat(eewData.earthquake.hypocenter.coordinate.latitude.value),
          lon: parseFloat(eewData.earthquake.hypocenter.coordinate.longitude.value),
          landOrSea: eewData.earthquake.hypocenter.landOrSea
        }
      } : null,
      
      maxIntensity: eewData.intensity ? {
        from: eewData.intensity.forecastMaxInt.from,
        to: eewData.intensity.forecastMaxInt.to
      } : null,
      
      warningRegions: eewData.intensity?.regions 
        ? eewData.intensity.regions
            .filter(r => r.isWarning)
            .map(r => ({
              name: r.name,
              code: r.code,
              intensity: {
                from: r.forecastMaxInt.from,
                to: r.forecastMaxInt.to
              },
              condition: r.condition
            }))
        : [],
      
      affectedAreas: {
        zones: eewData.zones?.map(z => ({ code: z.code, name: z.name })) || [],
        prefectures: eewData.prefectures?.map(p => ({ code: p.code, name: p.name })) || [],
        regions: eewData.regions?.map(r => ({ code: r.code, name: r.name })) || []
      },
      
      warningMessage: eewData.comments?.warning?.text
    };
  }

  /**
   * Check if this is a significant update compared to previous EEW
   */
  static isSignificantUpdate(current: EEWData, previous: EEWData | null): boolean {
    if (!previous) return true;
    
    // Check if canceled status changed
    if (current.isCanceled !== previous.isCanceled) return true;
    
    // Check if warning status changed
    if (current.isWarning !== previous.isWarning) return true;
    
    // Check if magnitude changed significantly (0.2 or more)
    if (current.earthquake && previous.earthquake) {
      const currentMag = parseFloat(current.earthquake.magnitude.value);
      const previousMag = parseFloat(previous.earthquake.magnitude.value);
      if (Math.abs(currentMag - previousMag) >= 0.2) return true;
    }
    
    // Check if maximum intensity changed
    if (current.intensity && previous.intensity) {
      if (current.intensity.forecastMaxInt.from !== previous.intensity.forecastMaxInt.from ||
          current.intensity.forecastMaxInt.to !== previous.intensity.forecastMaxInt.to) {
        return true;
      }
    }
    
    // Check if new warning regions added
    if (current.intensity?.regions && previous.intensity?.regions) {
      const currentWarningRegions = new Set(
        current.intensity.regions
          .filter(r => r.isWarning)
          .map(r => r.code)
      );
      const previousWarningRegions = new Set(
        previous.intensity.regions
          .filter(r => r.isWarning)
          .map(r => r.code)
      );
      
      for (const code of currentWarningRegions) {
        if (!previousWarningRegions.has(code)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Format intensity for display
   */
  static formatIntensity(from: string, to: string): string {
    if (from === to) {
      return `震度${from}`;
    }
    return `震度${from}〜${to}`;
  }

  /**
   * Get severity level (for prioritization)
   * Higher number = more severe
   */
  static getSeverityLevel(eewData: EEWData): number {
    if (eewData.isCanceled) return 0;
    
    const intensityMap: Record<string, number> = {
      '2': 2,
      '3': 3,
      '4': 4,
      '5-': 5,
      '5+': 5.5,
      '6-': 6,
      '6+': 6.5,
      '7': 7
    };
    
    const maxIntensity = eewData.intensity?.forecastMaxInt?.to 
      ? (intensityMap[eewData.intensity.forecastMaxInt.to] || 0)
      : 0;
    
    const magnitude = eewData.earthquake?.magnitude?.value 
      ? parseFloat(eewData.earthquake.magnitude.value)
      : 0;
    
    // Consider both intensity and magnitude
    return maxIntensity * 10 + magnitude;
  }
}