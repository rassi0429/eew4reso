// EEW (緊急地震速報) Type Definitions

export interface EEWMessage {
  type: 'eew' | 'quake_info';
  timestamp: number;
  data: EEWData | string;
  eewbot?: EEWBotData;
}

export interface EEWBotData {
  isWarning?: boolean;
  isFinal?: boolean;
  isCanceled?: boolean;
  serialNo?: string;
  reportDateTime?: string;
  epicenter?: string;
  depth?: string;
  magnitude?: string;
  maxIntensity?: string;
  regions?: any[];
  concurrent?: boolean;
  concurrentIndex?: number;
  // For quake_info type
  eventId?: number;
  title?: string;
  infoType?: string;
  serial?: string;
  status?: string;
  intensityAreas?: any[];
}

export interface EEWData {
  isLastInfo: boolean;
  isCanceled: boolean;
  isWarning: boolean;
  zones?: Zone[];
  prefectures?: Prefecture[];
  regions?: Region[];
  earthquake?: Earthquake;
  intensity?: Intensity;
  comments?: Comments;
  text?: string; // For cancellation messages
}

export interface Kind {
  lastKind?: {
    code: string;
    name: string;
  };
  code: string;
  name: string;
}

export interface Zone {
  kind: Kind;
  code: string;
  name: string;
}

export interface Prefecture {
  kind: Kind;
  code: string;
  name: string;
}

export interface Region {
  kind: Kind;
  code: string;
  name: string;
}

export interface Earthquake {
  originTime: string;
  arrivalTime: string;
  hypocenter: Hypocenter;
  magnitude: Magnitude;
}

export interface Hypocenter {
  coordinate: Coordinate;
  depth: Depth;
  reduce: CodeName;
  landOrSea: '内陸' | '海域';
  accuracy: Accuracy;
  code: string;
  name: string;
}

export interface Coordinate {
  latitude: ValueText;
  longitude: ValueText;
  height: {
    type: string;
    unit: string;
    value: string;
  };
  geodeticSystem: string;
}

export interface ValueText {
  text: string;
  value: string;
}

export interface Depth {
  type: string;
  unit: string;
  value: string;
}

export interface CodeName {
  code: string;
  name: string;
}

export interface Accuracy {
  epicenters: string[];
  depth: string;
  magnitudeCalculation: string;
  numberOfMagnitudeCalculation: string;
}

export interface Magnitude {
  type: string;
  unit: string;
  value: string;
}

export interface Intensity {
  forecastMaxInt: IntensityRange;
  forecastMaxLgInt: IntensityRange;
  appendix?: IntensityAppendix;
  regions: IntensityRegion[];
}

export interface IntensityRange {
  from: string;
  to: string;
}

export interface IntensityAppendix {
  maxIntChange: string;
  maxLgIntChange: string;
  maxIntChangeReason: string;
}

export interface IntensityRegion {
  condition?: string;
  forecastMaxInt: IntensityRange;
  forecastMaxLgInt: IntensityRange;
  isPlum: boolean;
  isWarning: boolean;
  kind: {
    code: string;
    name: string;
  };
  code: string;
  name: string;
}

export interface Comments {
  warning?: {
    text: string;
    codes: string[];
  };
}

// Utility types for intensity values
export type SeismicIntensity = '2' | '3' | '4' | '5-' | '5+' | '6-' | '6+' | '7';
export type LongPeriodIntensity = '0' | '1' | '2' | '3' | '4';

// Constants
export const SEISMIC_INTENSITY_LABELS: Record<SeismicIntensity, string> = {
  '2': '震度2',
  '3': '震度3',
  '4': '震度4',
  '5-': '震度5弱',
  '5+': '震度5強',
  '6-': '震度6弱',
  '6+': '震度6強',
  '7': '震度7'
};

export const LONG_PERIOD_INTENSITY_LABELS: Record<LongPeriodIntensity, string> = {
  '0': '階級0',
  '1': '階級1',
  '2': '階級2',
  '3': '階級3',
  '4': '階級4'
};

export const KIND_CODES = {
  NONE: '00',
  WARNING: '11',
  WARNING_ALT: '31'
} as const;

export const WARNING_CODE_MESSAGES: Record<string, string> = {
  '0201': '強い揺れに警戒してください。'
};