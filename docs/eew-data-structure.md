# EEW (緊急地震速報) Data Structure Documentation

## Overview
The EEW data is transmitted as newline-separated JSON objects. Each line contains a complete EEW event object.

## Root Structure
```typescript
{
  type: "eew",
  timestamp: number,  // Unix timestamp in milliseconds
  data: EEWData
}
```

## EEWData Structure

### Basic Information
- `isLastInfo`: boolean - Whether this is the final report for this earthquake
- `isCanceled`: boolean - Whether the EEW has been canceled
- `isWarning`: boolean - Whether this is a warning-level alert

### Geographic Information

#### Zones (地方)
Large geographic zones affected by the earthquake
```typescript
zones: [{
  kind: {
    lastKind: { code: string, name: string },
    code: string,  // e.g., "31" for 緊急地震速報（警報）
    name: string   // e.g., "緊急地震速報（警報）"
  },
  code: string,    // e.g., "9934"
  name: string     // e.g., "北陸"
}]
```

#### Prefectures (都道府県)
Prefecture-level areas
```typescript
prefectures: [{
  kind: {
    lastKind: { code: string, name: string },
    code: string,
    name: string
  },
  code: string,    // e.g., "9170"
  name: string     // e.g., "石川"
}]
```

#### Regions (地域)
More specific regional areas
```typescript
regions: [{
  kind: {
    lastKind: { code: string, name: string },
    code: string,
    name: string
  },
  code: string,    // e.g., "390"
  name: string     // e.g., "石川県能登"
}]
```

### Earthquake Information

```typescript
earthquake: {
  originTime: string,    // ISO 8601 format with timezone (e.g., "2024-01-01T16:10:08+09:00")
  arrivalTime: string,   // ISO 8601 format with timezone
  
  hypocenter: {
    coordinate: {
      latitude: {
        text: string,    // e.g., "37.5˚N"
        value: string    // e.g., "37.5000"
      },
      longitude: {
        text: string,    // e.g., "137.2˚E"
        value: string    // e.g., "137.2000"
      },
      height: {
        type: string,    // "高さ"
        unit: string,    // "m"
        value: string    // e.g., "-10000"
      },
      geodeticSystem: string  // "日本測地系"
    },
    
    depth: {
      type: string,      // "深さ"
      unit: string,      // "km"
      value: string      // e.g., "10"
    },
    
    reduce: {
      code: string,      // e.g., "9170"
      name: string       // e.g., "石川県"
    },
    
    landOrSea: string,   // "内陸" or "海域"
    
    accuracy: {
      epicenters: string[],              // e.g., ["3", "3"]
      depth: string,                     // e.g., "3"
      magnitudeCalculation: string,      // e.g., "5"
      numberOfMagnitudeCalculation: string // e.g., "4"
    },
    
    code: string,        // e.g., "390"
    name: string         // e.g., "石川県能登地方"
  },
  
  magnitude: {
    type: string,        // "マグニチュード"
    unit: string,        // "Mj" (Japan Meteorological Agency magnitude)
    value: string        // e.g., "5.8"
  }
}
```

### Intensity Information

```typescript
intensity: {
  forecastMaxInt: {
    from: string,        // e.g., "5-", "6+"
    to: string           // e.g., "5-", "6+"
  },
  
  forecastMaxLgInt: {    // Long-period ground motion intensity
    from: string,        // e.g., "1"
    to: string           // e.g., "1"
  },
  
  appendix: {
    maxIntChange: string,
    maxLgIntChange: string,
    maxIntChangeReason: string
  },
  
  regions: [{
    condition?: string,   // e.g., "既に主要動到達と推測" (Main shock estimated to have arrived)
    forecastMaxInt: {
      from: string,
      to: string
    },
    forecastMaxLgInt: {
      from: string,
      to: string
    },
    isPlum: boolean,     // Whether this is a PLUM method forecast
    isWarning: boolean,  // Whether this region has a warning
    kind: {
      code: string,      // "11" for warning, "00" for forecast
      name: string       // "緊急地震速報（警報）" or "緊急地震速報（予報）"
    },
    code: string,
    name: string
  }]
}
```

### Comments

```typescript
comments: {
  warning?: {
    text: string,        // e.g., "強い揺れに警戒してください。"
    codes: string[]      // e.g., ["0201"]
  }
}
```

## Intensity Scale

### Seismic Intensity (震度)
- `2`: 震度2
- `3`: 震度3
- `4`: 震度4
- `5-`: 震度5弱
- `5+`: 震度5強
- `6-`: 震度6弱
- `6+`: 震度6強
- `7`: 震度7

### Long-Period Ground Motion (長周期地震動階級)
- `0`: 階級0
- `1`: 階級1
- `2`: 階級2
- `3`: 階級3
- `4`: 階級4

## Code Reference

### Kind Codes
- `00`: なし (None)
- `11`: 緊急地震速報（警報）
- `31`: 緊急地震速報（警報）

### Warning Text Codes
- `0201`: 強い揺れに警戒してください。(Be alert for strong shaking)