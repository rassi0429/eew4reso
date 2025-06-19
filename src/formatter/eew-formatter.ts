import { EEWData, EEWMessage } from '../types/eew';
import { EEWParser } from '../parser/eew-parser';

export class EEWFormatter {
  /**
   * Format EEW data for human-readable text (Misskey post)
   */
  static formatForMisskey(message: EEWMessage): string {
    const data = message.data;
    const keyInfo = EEWParser.extractKeyInfo(data);
    
    // Handle cancellation messages
    if (data.isCanceled) {
      return this.formatCancellation(data, keyInfo);
    }
    
    // Handle different types of EEW messages
    if (data.isWarning && keyInfo.earthquake && keyInfo.maxIntensity) {
      return this.formatWarning(data, keyInfo, message);
    } else if (keyInfo.earthquake) {
      return this.formatForecast(data, keyInfo, message);
    } else {
      return this.formatBasicInfo(data, keyInfo, message);
    }
  }
  
  /**
   * Format cancellation message
   */
  private static formatCancellation(data: EEWData, keyInfo: any): string {
    const parts = [
      '🚫 **緊急地震速報 取り消し**',
      '',
      keyInfo.cancelText || '先ほどの緊急地震速報を取り消します。',
      '',
      `⏰ ${new Date().toLocaleString('ja-JP')}`
    ];
    
    return parts.join('\n');
  }
  
  /**
   * Format warning message (警報)
   */
  private static formatWarning(data: EEWData, keyInfo: any, message: EEWMessage): string {
    const earthquake = keyInfo.earthquake!;
    const maxIntensity = keyInfo.maxIntensity!;
    
    const parts = [
      '🚨 **緊急地震速報（警報）**',
      '',
      `📍 **震源地**: ${earthquake.epicenter.name}`,
      `📊 **マグニチュード**: M${earthquake.magnitude}`,
      `📏 **深さ**: ${earthquake.depth}km`,
      `🌊 **陸海**: ${earthquake.epicenter.landOrSea}`,
      '',
      `⚡ **最大予想震度**: ${EEWParser.formatIntensity(maxIntensity.from, maxIntensity.to)}`,
      ''
    ];
    
    // Add warning regions
    if (keyInfo.warningRegions.length > 0) {
      parts.push('🔴 **警報対象地域**:');
      keyInfo.warningRegions.slice(0, 5).forEach((region: any) => {
        const intensity = EEWParser.formatIntensity(region.intensity.from, region.intensity.to);
        const condition = region.condition ? ` (${region.condition})` : '';
        parts.push(`　• ${region.name}: ${intensity}${condition}`);
      });
      
      if (keyInfo.warningRegions.length > 5) {
        parts.push(`　...他${keyInfo.warningRegions.length - 5}地域`);
      }
      parts.push('');
    }
    
    // Add warning message
    if (keyInfo.warningMessage) {
      parts.push(`⚠️ ${keyInfo.warningMessage}`);
      parts.push('');
    }
    
    parts.push(
      `🕐 **発生時刻**: ${earthquake.originTime.toLocaleString('ja-JP')}`,
      `⏰ **情報時刻**: ${new Date(message.timestamp).toLocaleString('ja-JP')}`,
      '',
      data.isLastInfo ? '📋 最終報' : '📄 続報あり'
    );
    
    return parts.join('\n');
  }
  
  /**
   * Format forecast message (予報)
   */
  private static formatForecast(data: EEWData, keyInfo: any, message: EEWMessage): string {
    const earthquake = keyInfo.earthquake!;
    
    const parts = [
      '📊 **緊急地震速報（予報）**',
      '',
      `📍 **震源地**: ${earthquake.epicenter.name}`,
      `📊 **マグニチュード**: M${earthquake.magnitude}`,
      `📏 **深さ**: ${earthquake.depth}km`,
      `🌊 **陸海**: ${earthquake.epicenter.landOrSea}`,
      ''
    ];
    
    // Add intensity if available
    if (keyInfo.maxIntensity) {
      parts.push(`⚡ **最大予想震度**: ${EEWParser.formatIntensity(keyInfo.maxIntensity.from, keyInfo.maxIntensity.to)}`);
      parts.push('');
    }
    
    parts.push(
      `🕐 **発生時刻**: ${earthquake.originTime.toLocaleString('ja-JP')}`,
      `⏰ **情報時刻**: ${new Date(message.timestamp).toLocaleString('ja-JP')}`,
      '',
      data.isLastInfo ? '📋 最終報' : '📄 続報あり'
    );
    
    return parts.join('\n');
  }
  
  /**
   * Format basic info (minimal data)
   */
  private static formatBasicInfo(data: EEWData, keyInfo: any, message: EEWMessage): string {
    const parts = [
      '📡 **緊急地震速報**',
      '',
      '詳細情報を取得中...',
      '',
      `⏰ ${new Date(message.timestamp).toLocaleString('ja-JP')}`
    ];
    
    return parts.join('\n');
  }
  
  /**
   * Format short version for quick notifications
   */
  static formatShort(message: EEWMessage): string {
    const data = message.data;
    const keyInfo = EEWParser.extractKeyInfo(data);
    
    if (data.isCanceled) {
      return '🚫 緊急地震速報 取り消し';
    }
    
    if (!keyInfo.earthquake) {
      return '📡 緊急地震速報';
    }
    
    const earthquake = keyInfo.earthquake;
    const intensity = keyInfo.maxIntensity 
      ? ` 最大${EEWParser.formatIntensity(keyInfo.maxIntensity.from, keyInfo.maxIntensity.to)}`
      : '';
    
    const warningIcon = data.isWarning ? '🚨' : '📊';
    
    return `${warningIcon} ${earthquake.epicenter.name} M${earthquake.magnitude}${intensity}`;
  }
  
  /**
   * Create hashtags for the post
   */
  static createHashtags(message: EEWMessage): string[] {
    const data = message.data;
    const keyInfo = EEWParser.extractKeyInfo(data);
    const tags = ['#緊急地震速報', '#EEW'];
    
    if (data.isWarning) {
      tags.push('#地震警報');
    }
    
    if (data.isCanceled) {
      tags.push('#取り消し');
    }
    
    if (keyInfo.earthquake) {
      // Add prefecture tags
      keyInfo.affectedAreas.prefectures.slice(0, 3).forEach(pref => {
        tags.push(`#${pref.name}`);
      });
      
      // Add intensity tag
      if (keyInfo.maxIntensity) {
        const intensity = keyInfo.maxIntensity.to;
        if (['6-', '6+', '7'].includes(intensity)) {
          tags.push('#強震');
        } else if (['5-', '5+'].includes(intensity)) {
          tags.push('#中震');
        }
      }
    }
    
    return tags.slice(0, 8); // Limit to 8 tags
  }
  
  /**
   * Get severity emoji based on intensity
   */
  static getSeverityEmoji(data: EEWData): string {
    const keyInfo = EEWParser.extractKeyInfo(data);
    
    if (data.isCanceled) return '🚫';
    if (!keyInfo.maxIntensity) return '📊';
    
    const intensity = keyInfo.maxIntensity.to;
    
    switch (intensity) {
      case '7': return '🔴';
      case '6+': return '🟠';
      case '6-': return '🟡';
      case '5+': return '🟡';
      case '5-': return '🟢';
      default: return '🔵';
    }
  }
  
  /**
   * Format with custom template
   */
  static formatCustom(message: EEWMessage, template: string): string {
    const data = message.data;
    const keyInfo = EEWParser.extractKeyInfo(data);
    
    let result = template;
    
    // Replace placeholders
    const replacements: Record<string, string> = {
      '{type}': data.isWarning ? '警報' : '予報',
      '{canceled}': data.isCanceled ? '取り消し' : '',
      '{magnitude}': keyInfo.earthquake?.magnitude.toString() || 'N/A',
      '{depth}': keyInfo.earthquake?.depth.toString() || 'N/A',
      '{epicenter}': keyInfo.earthquake?.epicenter.name || 'N/A',
      '{intensity}': keyInfo.maxIntensity 
        ? EEWParser.formatIntensity(keyInfo.maxIntensity.from, keyInfo.maxIntensity.to)
        : 'N/A',
      '{time}': keyInfo.earthquake?.originTime.toLocaleString('ja-JP') || 'N/A',
      '{emoji}': this.getSeverityEmoji(data),
      '{hashtags}': this.createHashtags(message).join(' ')
    };
    
    Object.entries(replacements).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value);
    });
    
    return result;
  }
}