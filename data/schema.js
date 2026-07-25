const VEHICLE_NUMBERS = [
  'listPrice', 'batteryKwh', 'rangeKm', 'consumptionKwhPer100km',
  'bootLitresSeatsUp', 'bootLitresSeatsDown', 'seats', 'towKg',
  'warrantyYears', 'insuranceAnnual'
];
const VEHICLE_STRINGS = ['id', 'familyId', 'make', 'model', 'variant', 'bodyType', 'sourcedAt'];

// Plausibility ranges. Anything outside these is almost certainly a typo, a
// unit mix-up (e.g. Wh instead of kWh) or a placeholder value, not a real car.
export const NUMERIC_BOUNDS = {
  listPrice: [15000, 250000],
  batteryKwh: [15, 200],
  rangeKm: [100, 1000],
  consumptionKwhPer100km: [8, 35],
  bootLitresSeatsUp: [100, 1200],
  bootLitresSeatsDown: [200, 3000],
  seats: [2, 9],
  towKg: [0, 3500],
  warrantyYears: [1, 10],
  insuranceAnnual: [500, 6000]
};
const INTEGER_FIELDS = new Set(['seats', 'warrantyYears']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_URL_RE = /^https:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;

// batteryKwh / rangeKm * 100 implies a consumption figure; if the stated
// consumptionKwhPer100km is wildly different, one of the three numbers is
// probably wrong (classic failure mode: a kWh/Wh mix-up on one field).
const CONSUMPTION_TOLERANCE = 0.25;

export function validateVehicle(row) {
  const errors = [];
  if (!row || typeof row !== 'object') return { valid: false, errors: ['row is not an object'] };

  for (const field of VEHICLE_STRINGS) {
    if (typeof row[field] !== 'string' || row[field].length === 0) {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (typeof row.sourcedAt === 'string' && row.sourcedAt.length > 0 && !DATE_RE.test(row.sourcedAt)) {
    errors.push('sourcedAt must match YYYY-MM-DD');
  }

  for (const field of VEHICLE_NUMBERS) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${field} must be a finite number`);
      continue;
    }
    const [min, max] = NUMERIC_BOUNDS[field];
    if (value < min || value > max) {
      errors.push(`${field} must be between ${min} and ${max}, got ${value}`);
    }
    if (INTEGER_FIELDS.has(field) && !Number.isInteger(value)) {
      errors.push(`${field} must be a whole number, got ${value}`);
    }
  }

  if (
    typeof row.bootLitresSeatsUp === 'number' && Number.isFinite(row.bootLitresSeatsUp) &&
    typeof row.bootLitresSeatsDown === 'number' && Number.isFinite(row.bootLitresSeatsDown) &&
    row.bootLitresSeatsDown < row.bootLitresSeatsUp
  ) {
    errors.push(`bootLitresSeatsDown (${row.bootLitresSeatsDown}) must be >= bootLitresSeatsUp (${row.bootLitresSeatsUp})`);
  }

  if (
    typeof row.batteryKwh === 'number' && Number.isFinite(row.batteryKwh) &&
    typeof row.rangeKm === 'number' && Number.isFinite(row.rangeKm) && row.rangeKm > 0 &&
    typeof row.consumptionKwhPer100km === 'number' && Number.isFinite(row.consumptionKwhPer100km) &&
    row.consumptionKwhPer100km !== 0
  ) {
    const implied = (row.batteryKwh / row.rangeKm) * 100;
    const stated = row.consumptionKwhPer100km;
    const relativeDiff = Math.abs(implied - stated) / stated;
    if (relativeDiff > CONSUMPTION_TOLERANCE) {
      errors.push(
        `consumptionKwhPer100km (${stated}) is inconsistent with batteryKwh/rangeKm, which implies ${implied.toFixed(1)}kWh/100km — more than ${CONSUMPTION_TOLERANCE * 100}% apart`
      );
    }
  }

  const curve = row.depreciationCurve;
  if (!Array.isArray(curve) || curve.length < 2) {
    errors.push('depreciationCurve must be an array of at least two values');
  } else {
    if (curve[0] !== 1) errors.push('depreciationCurve must start at 1');
    if (curve.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) {
      errors.push('depreciationCurve values must all be between 0 and 1');
    }
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
  if (typeof entry.sourcedAt !== 'string') {
    errors.push('sourcedAt must be a date string');
  } else if (!DATE_RE.test(entry.sourcedAt)) {
    errors.push('sourcedAt must match YYYY-MM-DD');
  }

  const lists = { pros: 3, cons: 2, sources: 1, images: 1 };
  for (const [field, minimum] of Object.entries(lists)) {
    if (!Array.isArray(entry[field]) || entry[field].length < minimum) {
      errors.push(`${field} must be an array of at least ${minimum}`);
    }
  }

  if (Array.isArray(entry.pros) && entry.pros.some(v => typeof v !== 'string' || v.trim().length === 0)) {
    errors.push('pros must contain only non-empty strings');
  }
  if (Array.isArray(entry.cons) && entry.cons.some(v => typeof v !== 'string' || v.trim().length === 0)) {
    errors.push('cons must contain only non-empty strings');
  }
  if (Array.isArray(entry.sources) && entry.sources.some(u => typeof u !== 'string' || !u.startsWith('https://'))) {
    errors.push('sources must all be https URLs');
  }
  if (Array.isArray(entry.images) && entry.images.some(u => typeof u !== 'string' || !IMAGE_URL_RE.test(u))) {
    errors.push('images must all be https URLs ending in .jpg, .jpeg, .png or .webp');
  }

  return { valid: errors.length === 0, errors };
}

export function loadDataset({ vehicles, families }) {
  const skippedFamilies = [];
  const validFamilies = [];

  for (const entry of families) {
    const result = validateFamily(entry);
    if (result.valid) validFamilies.push(entry);
    else skippedFamilies.push({ id: entry?.id ?? 'unknown', errors: result.errors });
  }

  const familyIds = new Set(validFamilies.map(f => f.id));
  const seenVehicleIds = new Set();
  const skipped = [];
  const valid = [];

  for (const row of vehicles) {
    const result = validateVehicle(row);
    const errors = [...result.errors];

    if (result.valid && !familyIds.has(row.familyId)) {
      errors.push(`familyId '${row.familyId}' does not reference a known (valid) family`);
    }

    if (errors.length > 0) {
      skipped.push({ id: row?.id ?? 'unknown', errors });
      continue;
    }

    if (seenVehicleIds.has(row.id)) {
      skipped.push({ id: row.id, errors: [`duplicate vehicle id '${row.id}'`] });
      continue;
    }
    seenVehicleIds.add(row.id);
    valid.push(row);
  }

  return { vehicles: valid, families: validFamilies, skipped, skippedFamilies };
}
