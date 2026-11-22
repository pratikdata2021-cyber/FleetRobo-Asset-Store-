export type BluetoothSupportValue = 'Yes' | 'BLE' | 'Not specified';

export const DEVICE_MODEL_CATEGORIES = [
  'GPS',
  'AIS GPS',
  'Portable GPS',
  'E-Lock',
  'Video Telematics',
] as const;

export type DeviceModelCategoryName = (typeof DEVICE_MODEL_CATEGORIES)[number] | (string & {});

export const BLUETOOTH_SUPPORT_OPTIONS: readonly BluetoothSupportValue[] = [
  'Not specified',
  'Yes',
  'BLE',
];

export interface DeviceModelSeedRecord {
  id: string;
  srNo: number;
  deviceCategory: DeviceModelCategoryName;
  brand: string;
  model: string;
  bluetoothSupport: BluetoothSupportValue;
}

export const DEVICE_MODEL_STORAGE_KEY = 'fleetrobo_device_model_master_v1';
export const DEVICE_MODEL_UPDATED_EVENT = 'fleetrobo:device-models-updated';

export const INITIAL_DEVICE_MODEL_SEED: DeviceModelSeedRecord[] = [
  { id: 'dmod-01', srNo: 1, deviceCategory: 'GPS', brand: 'Acumen', model: 'G20', bluetoothSupport: 'Not specified' },
  { id: 'dmod-02', srNo: 2, deviceCategory: 'GPS', brand: 'Acumen', model: 'M04', bluetoothSupport: 'Not specified' },
  { id: 'dmod-03', srNo: 3, deviceCategory: 'GPS', brand: 'Acumen', model: 'M1', bluetoothSupport: 'Not specified' },
  { id: 'dmod-04', srNo: 4, deviceCategory: 'GPS', brand: 'Acumen TOPFLY', model: 'Solar X120', bluetoothSupport: 'BLE' },
  { id: 'dmod-05', srNo: 5, deviceCategory: 'GPS', brand: 'Amit', model: 'SK05', bluetoothSupport: 'Not specified' },
  { id: 'dmod-06', srNo: 6, deviceCategory: 'GPS', brand: 'Atlanta', model: 'AL100', bluetoothSupport: 'Not specified' },
  { id: 'dmod-07', srNo: 7, deviceCategory: 'GPS', brand: 'Atlanta', model: 'CW-100', bluetoothSupport: 'Not specified' },
  { id: 'dmod-08', srNo: 8, deviceCategory: 'GPS', brand: 'Atlanta', model: 'E101', bluetoothSupport: 'Not specified' },
  { id: 'dmod-09', srNo: 9, deviceCategory: 'GPS', brand: 'Atlanta', model: 'L400', bluetoothSupport: 'Not specified' },
  { id: 'dmod-10', srNo: 10, deviceCategory: 'GPS', brand: 'Atlanta', model: 'LC100', bluetoothSupport: 'Not specified' },
  { id: 'dmod-11', srNo: 11, deviceCategory: 'GPS', brand: 'Atlanta', model: 'WP30L', bluetoothSupport: 'Not specified' },
  { id: 'dmod-12', srNo: 12, deviceCategory: 'GPS', brand: 'Bharat 101', model: 'Bharat 101', bluetoothSupport: 'Not specified' },
  { id: 'dmod-13', srNo: 13, deviceCategory: 'GPS', brand: 'Binary', model: 'FR Lite', bluetoothSupport: 'Not specified' },
  { id: 'dmod-14', srNo: 14, deviceCategory: 'GPS', brand: 'Binary', model: 'FR5', bluetoothSupport: 'Not specified' },
  { id: 'dmod-15', srNo: 15, deviceCategory: 'GPS', brand: 'G-trophy', model: 'AIS 140', bluetoothSupport: 'Not specified' },
  { id: 'dmod-16', srNo: 16, deviceCategory: 'GPS', brand: 'Map my India', model: 'MMI350758', bluetoothSupport: 'Not specified' },
  { id: 'dmod-17', srNo: 17, deviceCategory: 'GPS', brand: 'Map my India', model: 'MT 100', bluetoothSupport: 'Not specified' },
  { id: 'dmod-18', srNo: 18, deviceCategory: 'GPS', brand: 'Pictor', model: 'Model Not Specified', bluetoothSupport: 'Not specified' },
  { id: 'dmod-19', srNo: 19, deviceCategory: 'GPS', brand: 'Pictor', model: 'P06', bluetoothSupport: 'Not specified' },
  { id: 'dmod-20', srNo: 20, deviceCategory: 'GPS', brand: 'Pictor', model: 'PS03', bluetoothSupport: 'Not specified' },
  { id: 'dmod-21', srNo: 21, deviceCategory: 'GPS', brand: 'Pictor', model: 'PS10C', bluetoothSupport: 'Not specified' },
  { id: 'dmod-22', srNo: 22, deviceCategory: 'GPS', brand: 'Pictor', model: 'V5', bluetoothSupport: 'Not specified' },
  { id: 'dmod-23', srNo: 23, deviceCategory: 'GPS', brand: 'Pictor', model: 'XYZ,PT06 lite', bluetoothSupport: 'Not specified' },
  { id: 'dmod-24', srNo: 24, deviceCategory: 'GPS', brand: 'Pictor/Telemologix', model: 'XYZ,PT06/G5B/G61/GH02/', bluetoothSupport: 'Not specified' },
  { id: 'dmod-25', srNo: 25, deviceCategory: 'GPS', brand: 'Road Pin', model: 'AT200', bluetoothSupport: 'Not specified' },
  { id: 'dmod-26', srNo: 26, deviceCategory: 'GPS', brand: 'Road Pin', model: 'ET300', bluetoothSupport: 'Not specified' },
  { id: 'dmod-27', srNo: 27, deviceCategory: 'GPS', brand: 'Road Pin', model: 'GAGAN 101', bluetoothSupport: 'Not specified' },
  { id: 'dmod-28', srNo: 28, deviceCategory: 'GPS', brand: 'Road Pin', model: 'JV07', bluetoothSupport: 'Not specified' },
  { id: 'dmod-29', srNo: 29, deviceCategory: 'GPS', brand: 'Road Pin', model: 'RP06', bluetoothSupport: 'Not specified' },
  { id: 'dmod-30', srNo: 30, deviceCategory: 'GPS', brand: 'Teltonika', model: 'ATRM50', bluetoothSupport: 'Yes' },
  { id: 'dmod-31', srNo: 31, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMB120', bluetoothSupport: 'Yes' },
  { id: 'dmod-32', srNo: 32, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMB125', bluetoothSupport: 'Yes' },
  { id: 'dmod-33', srNo: 33, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMB207', bluetoothSupport: 'Yes' },
  { id: 'dmod-34', srNo: 34, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMB209', bluetoothSupport: 'Not specified' },
  { id: 'dmod-35', srNo: 35, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMB910', bluetoothSupport: 'Yes' },
  { id: 'dmod-36', srNo: 36, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMB920', bluetoothSupport: 'Yes' },
  { id: 'dmod-37', srNo: 37, deviceCategory: 'GPS', brand: 'Teltonika', model: 'FMC920', bluetoothSupport: 'Not specified' },
  { id: 'dmod-38', srNo: 38, deviceCategory: 'GPS', brand: 'Teltonika', model: 'Model Not Specified', bluetoothSupport: 'Not specified' },
  { id: 'dmod-39', srNo: 39, deviceCategory: 'GPS', brand: 'Teltonika', model: 'TF100', bluetoothSupport: 'Not specified' },
  { id: 'dmod-40', srNo: 40, deviceCategory: 'GPS', brand: 'TOPFLY', model: 'PioneerX100', bluetoothSupport: 'Yes' },
  { id: 'dmod-41', srNo: 41, deviceCategory: 'GPS', brand: 'Transight', model: 'Discovery 2G', bluetoothSupport: 'Not specified' },
  { id: 'dmod-42', srNo: 42, deviceCategory: 'GPS', brand: 'Transight', model: 'TSB101', bluetoothSupport: 'Not specified' },
  { id: 'dmod-43', srNo: 43, deviceCategory: 'GPS', brand: 'Unknown', model: 'Model Not Specified', bluetoothSupport: 'Not specified' },
  { id: 'dmod-44', srNo: 44, deviceCategory: 'GPS', brand: 'Volty', model: 'Volty-AIS 140', bluetoothSupport: 'Not specified' },
  { id: 'dmod-45', srNo: 45, deviceCategory: 'AIS GPS', brand: 'Acute', model: 'AIS 140', bluetoothSupport: 'Not specified' },
  { id: 'dmod-46', srNo: 46, deviceCategory: 'AIS GPS', brand: 'Track now', model: 'AIS 140', bluetoothSupport: 'Not specified' },
  { id: 'dmod-47', srNo: 47, deviceCategory: 'Portable GPS', brand: 'Pictor', model: 'GS21', bluetoothSupport: 'Not specified' },
  { id: 'dmod-48', srNo: 48, deviceCategory: 'Portable GPS', brand: 'Pictor', model: 'PT002', bluetoothSupport: 'Not specified' },
  { id: 'dmod-49', srNo: 49, deviceCategory: 'Portable GPS', brand: 'Pictor', model: 'X10', bluetoothSupport: 'Not specified' },
  { id: 'dmod-50', srNo: 50, deviceCategory: 'Portable GPS', brand: 'Pictor/Road pin', model: 'S20', bluetoothSupport: 'Not specified' },
  { id: 'dmod-51', srNo: 51, deviceCategory: 'Portable GPS', brand: 'Road Pin', model: 'GT03A', bluetoothSupport: 'Not specified' },
  { id: 'dmod-52', srNo: 52, deviceCategory: 'Portable GPS', brand: 'Road Pin', model: 'JV200', bluetoothSupport: 'Not specified' },
  { id: 'dmod-53', srNo: 53, deviceCategory: 'Portable GPS', brand: 'Teltonika', model: 'FMB003', bluetoothSupport: 'Not specified' },
  { id: 'dmod-54', srNo: 54, deviceCategory: 'Portable GPS', brand: 'Teltonika', model: 'FMC003', bluetoothSupport: 'Not specified' },
  { id: 'dmod-55', srNo: 55, deviceCategory: 'Portable GPS', brand: 'Teltonika/Atlanta', model: 'OBD 400/FMB003', bluetoothSupport: 'Yes' },
  { id: 'dmod-56', srNo: 56, deviceCategory: 'E-Lock', brand: 'Atlanta', model: 'LC100+Digital Lock', bluetoothSupport: 'Not specified' },
  { id: 'dmod-57', srNo: 57, deviceCategory: 'E-Lock', brand: 'Atlanta', model: 'WP30L', bluetoothSupport: 'Not specified' },
  { id: 'dmod-58', srNo: 58, deviceCategory: 'E-Lock', brand: 'Dhanuka', model: '310P', bluetoothSupport: 'BLE' },
  { id: 'dmod-59', srNo: 59, deviceCategory: 'E-Lock', brand: 'G Trac', model: 'GL400', bluetoothSupport: 'BLE' },
  { id: 'dmod-60', srNo: 60, deviceCategory: 'E-Lock', brand: 'Galvanic', model: 'IoT (model unspecified)', bluetoothSupport: 'BLE' },
  { id: 'dmod-61', srNo: 61, deviceCategory: 'E-Lock', brand: 'I Triangle', model: 'TS101', bluetoothSupport: 'Not specified' },
  { id: 'dmod-62', srNo: 62, deviceCategory: 'E-Lock', brand: 'IMZ', model: 'GL400', bluetoothSupport: 'Not specified' },
  { id: 'dmod-63', srNo: 63, deviceCategory: 'E-Lock', brand: 'IMZ', model: 'JT701', bluetoothSupport: 'Not specified' },
  { id: 'dmod-64', srNo: 64, deviceCategory: 'E-Lock', brand: 'IMZ', model: 'JT701D', bluetoothSupport: 'Not specified' },
  { id: 'dmod-65', srNo: 65, deviceCategory: 'E-Lock', brand: 'IMZ', model: 'TraQ310', bluetoothSupport: 'Not specified' },
  { id: 'dmod-66', srNo: 66, deviceCategory: 'E-Lock', brand: 'IMZ', model: 'Traqloc508', bluetoothSupport: 'Not specified' },
  { id: 'dmod-67', srNo: 67, deviceCategory: 'E-Lock', brand: 'IMZ/Pictor', model: 'Traqloc310P', bluetoothSupport: 'Not specified' },
  { id: 'dmod-68', srNo: 68, deviceCategory: 'E-Lock', brand: 'IMZ/Road Pin', model: 'Model Not Specified', bluetoothSupport: 'Not specified' },
  { id: 'dmod-69', srNo: 69, deviceCategory: 'E-Lock', brand: 'Pictor', model: 'GL-600', bluetoothSupport: 'BLE' },
  { id: 'dmod-70', srNo: 70, deviceCategory: 'E-Lock', brand: 'Pictor', model: 'PL200', bluetoothSupport: 'BLE' },
  { id: 'dmod-71', srNo: 71, deviceCategory: 'E-Lock', brand: 'Pictor', model: 'PL610', bluetoothSupport: 'BLE' },
  { id: 'dmod-72', srNo: 72, deviceCategory: 'E-Lock', brand: 'Proxgy', model: 'Lockator', bluetoothSupport: 'BLE' },
  { id: 'dmod-73', srNo: 73, deviceCategory: 'E-Lock', brand: 'Road Pin', model: 'Traqloc508', bluetoothSupport: 'Not specified' },
  { id: 'dmod-74', srNo: 74, deviceCategory: 'Video Telematics', brand: 'Pictor/Metta', model: 'MC202L', bluetoothSupport: 'Not specified' },
  { id: 'dmod-75', srNo: 75, deviceCategory: 'Video Telematics', brand: 'Pictor/Metta', model: 'MC202N', bluetoothSupport: 'Not specified' },
  { id: 'dmod-76', srNo: 76, deviceCategory: 'Video Telematics', brand: 'Pictor/Metta', model: 'Model Not Specified', bluetoothSupport: 'Not specified' },
  { id: 'dmod-77', srNo: 77, deviceCategory: 'Video Telematics', brand: 'Star link', model: 'Model Not Specified', bluetoothSupport: 'Not specified' },
  { id: 'dmod-78', srNo: 78, deviceCategory: 'Video Telematics', brand: 'Streamax', model: 'C6D (V7.0) AD lite/AD plus', bluetoothSupport: 'Not specified' },
];

export function normalizeCompositePart(value: string): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getDeviceModelCompositeKey(
  deviceCategory: string,
  brand: string,
  model: string
): string {
  return [
    normalizeCompositePart(deviceCategory),
    normalizeCompositePart(brand),
    normalizeCompositePart(model),
  ].join('::');
}

export function normalizeBluetoothSupport(raw?: string): BluetoothSupportValue {
  const norm = normalizeCompositePart(raw || '');
  if (norm === 'yes') return 'Yes';
  if (norm === 'ble') return 'BLE';
  return 'Not specified';
}

export interface DeviceModelReviewInfo {
  needsReview: boolean;
  kind?: 'placeholder' | 'ambiguous';
  badgeText?: string;
  reason?: string;
}

export function getDeviceModelReviewInfo(
  rec: Pick<DeviceModelSeedRecord, 'brand' | 'model'>
): DeviceModelReviewInfo {
  const modelNorm = normalizeCompositePart(rec.model);
  const brandNorm = normalizeCompositePart(rec.brand);

  if (
    modelNorm === 'model not specified' ||
    modelNorm.includes('unspecified') ||
    modelNorm === 'not specified'
  ) {
    return {
      needsReview: true,
      kind: 'placeholder',
      badgeText: 'Review Placeholder',
      reason:
        'Treated as a review placeholder (not a confirmed hardware model). Do not guess missing model details.',
    };
  }

  const hasCombinedOrAmbiguous =
    rec.brand.includes('/') ||
    rec.model.includes('/') ||
    rec.model.includes(',') ||
    rec.model.includes('+') ||
    brandNorm === 'unknown';

  if (hasCombinedOrAmbiguous) {
    return {
      needsReview: true,
      kind: 'ambiguous',
      badgeText: 'Needs Review',
      reason:
        'Combined or ambiguous supplier string preserved verbatim as supplied; flagged for later review rather than silently splitting.',
    };
  }

  return { needsReview: false };
}

export function sortDeviceModels(records: DeviceModelSeedRecord[]): DeviceModelSeedRecord[] {
  const catRank = (cat: string) => {
    const idx = DEVICE_MODEL_CATEGORIES.findIndex(
      (c) => c.toLowerCase() === cat.trim().toLowerCase()
    );
    return idx === -1 ? 999 : idx;
  };

  const sorted = [...records].sort((a, b) => {
    const rankA = catRank(a.deviceCategory);
    const rankB = catRank(b.deviceCategory);
    if (rankA !== rankB) return rankA - rankB;

    if (rankA === 999) {
      const catCmp = a.deviceCategory.localeCompare(b.deviceCategory, undefined, {
        sensitivity: 'base',
      });
      if (catCmp !== 0) return catCmp;
    }

    const brandCmp = a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' });
    if (brandCmp !== 0) return brandCmp;

    return a.model.localeCompare(b.model, undefined, { sensitivity: 'base' });
  });

  return sorted.map((rec, idx) => ({
    ...rec,
    srNo: idx + 1,
  }));
}

export function deduplicateDeviceModels(
  records: DeviceModelSeedRecord[]
): DeviceModelSeedRecord[] {
  const seen = new Set<string>();
  const unique: DeviceModelSeedRecord[] = [];
  records.forEach((rec) => {
    const category = (rec.deviceCategory || '').trim();
    const brand = (rec.brand || '').trim();
    const model = (rec.model || '').trim();
    if (!category || !brand || !model) return;
    const key = getDeviceModelCompositeKey(category, brand, model);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({
      id: rec.id || `dmod-${Date.now()}-${unique.length + 1}`,
      srNo: unique.length + 1,
      deviceCategory: category,
      brand,
      model,
      bluetoothSupport: normalizeBluetoothSupport(rec.bluetoothSupport),
    });
  });
  return sortDeviceModels(unique);
}

export function loadDeviceModelStore(): DeviceModelSeedRecord[] {
  try {
    const raw = localStorage.getItem(DEVICE_MODEL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateDeviceModels(parsed);
      }
    }
  } catch {
    // fallback to seed
  }
  return sortDeviceModels(INITIAL_DEVICE_MODEL_SEED);
}

export function saveDeviceModelStore(records: DeviceModelSeedRecord[]): DeviceModelSeedRecord[] {
  const clean = deduplicateDeviceModels(records);
  try {
    localStorage.setItem(DEVICE_MODEL_STORAGE_KEY, JSON.stringify(clean));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DEVICE_MODEL_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent('fleetrobo:model-access-updated'));
    }
  } catch {
    // ignore storage errors
  }
  return clean;
}

export function resetDeviceModelStore(): DeviceModelSeedRecord[] {
  const clean = sortDeviceModels(INITIAL_DEVICE_MODEL_SEED);
  return saveDeviceModelStore(clean);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((cell) => cell.trim());
}

export function parseDeviceModelCsv(csvText: string): {
  rows: Omit<DeviceModelSeedRecord, 'id' | 'srNo'>[];
  skippedInvalid: number;
} {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [], skippedInvalid: 0 };

  const firstCells = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader =
    firstCells.some((c) => c.includes('category')) ||
    firstCells.some((c) => c.includes('brand')) ||
    firstCells.some((c) => c.includes('model'));

  let catIdx = 1;
  let brandIdx = 2;
  let modelIdx = 3;
  let btIdx = 4;
  let startRow = 0;

  if (hasHeader) {
    startRow = 1;
    const findIdx = (pred: (h: string) => boolean, fallback: number) => {
      const idx = firstCells.findIndex(pred);
      return idx >= 0 ? idx : fallback;
    };
    catIdx = findIdx((h) => h.includes('category'), 0);
    brandIdx = findIdx((h) => h.includes('brand') || h.includes('manufacturer'), 1);
    modelIdx = findIdx((h) => h.includes('model'), 2);
    btIdx = findIdx((h) => h.includes('bluetooth') || h.includes('ble'), -1);
  } else if (parseCsvLine(lines[0]).length <= 4) {
    catIdx = 0;
    brandIdx = 1;
    modelIdx = 2;
    btIdx = 3;
  }

  const rows: Omit<DeviceModelSeedRecord, 'id' | 'srNo'>[] = [];
  let skippedInvalid = 0;

  for (let i = startRow; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const deviceCategory = (cells[catIdx] || '').trim();
    const brand = (cells[brandIdx] || '').trim();
    const model = (cells[modelIdx] || '').trim();
    const bluetoothSupport =
      btIdx >= 0 ? normalizeBluetoothSupport(cells[btIdx]) : ('Not specified' as BluetoothSupportValue);

    if (!deviceCategory || !brand || !model) {
      skippedInvalid++;
      continue;
    }

    rows.push({
      deviceCategory,
      brand,
      model,
      bluetoothSupport,
    });
  }

  return { rows, skippedInvalid };
}
