// Type guard functions for EEW data types

import { EEWData, EEWMessage } from '../types/eew';

/**
 * Type guard to check if the data is standard EEW format
 */
export function isStandardEEWData(data: any): data is EEWData {
  return data && typeof data === 'object' && 
         'isLastInfo' in data && 
         'isCanceled' in data && 
         'isWarning' in data;
}

/**
 * Type guard to check if the message has standard EEW data
 */
export function hasStandardEEWData(message: EEWMessage): message is EEWMessage & { data: EEWData } {
  return typeof message.data === 'object' && isStandardEEWData(message.data);
}

/**
 * Type guard to check if the message has EEWBot data
 */
export function hasEEWBotData(message: EEWMessage): boolean {
  return typeof message.data === 'string' && !!message.eewbot;
}