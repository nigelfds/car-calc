const VEHICLE_NUMBERS = [
  'listPrice', 'batteryKwh', 'rangeKm', 'consumptionKwhPer100km',
  'bootLitresSeatsUp', 'bootLitresSeatsDown', 'seats', 'towKg',
  'warrantyYears', 'insuranceAnnual'
];
const VEHICLE_STRINGS = ['id', 'familyId', 'make', 'model', 'variant', 'bodyType', 'sourcedAt'];

export function validateVehicle(row) {
  const errors = [];
  if (!row || typeof row !== 'object') return { valid: false, errors: ['row is not an object'] };

  for (const field of VEHICLE_STRINGS) {
    if (typeof row[field] !== 'string' || row[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  for (const field of VEHICLE_NUMBERS) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) {
      errors.push(`${field} must be a finite number`);
    }
  }

  const curve = row.depreciationCurve;
  if (!Array.isArray(curve) || curve.length < 2) {
    errors.push('depreciationCurve must be an array of at least two values');
  } else {
    if (curve[0] !== 1) errors.push('depreciationCurve must start at 1');
    for (let i = 1; i < curve.length; i++) {
      if (curve[i] > curve[i - 1]) {
        errors.push('depreciationCurve must decline monotonically');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateFamily(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return { valid: false, errors: ['entry is not an object'] };

  if (typeof entry.id !== 'string' || !entry.id) errors.push('id must be a non-empty string');
  if (typeof entry.summary !== 'string' || entry.summary.length < 20) {
    errors.push('summary must be at least 20 characters');
  }
  if (typeof entry.sourcedAt !== 'string') errors.push('sourcedAt must be a date string');

  const lists = { pros: 3, cons: 2, sources: 1, images: 1 };
  for (const [field, minimum] of Object.entries(lists)) {
    if (!Array.isArray(entry[field]) || entry[field].length < minimum) {
      errors.push(`${field} must be an array of at least ${minimum}`);
    }
  }
  if (Array.isArray(entry.images) && entry.images.some(u => !u.startsWith('https://'))) {
    errors.push('images must all be https URLs');
  }

  return { valid: errors.length === 0, errors };
}

export function loadDataset({ vehicles, families }) {
  const skipped = [];
  const valid = [];

  for (const row of vehicles) {
    const result = validateVehicle(row);
    if (result.valid) valid.push(row);
    else skipped.push({ id: row?.id ?? 'unknown', errors: result.errors });
  }

  return { vehicles: valid, families, skipped };
}
