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

export const POWERTRAINS = ['bev', 'phev'];

// Absent means BEV — that is what keeps the existing 40 families from needing
// a migration. Everything downstream reads powertrain through this.
export const powertrainOf = row => row?.powertrain ?? 'bev';

// Fields that only a PHEV carries. Their presence on a row that has not
// declared powertrain: 'phev' is an error, not a harmless extra: the
// dangerous direction of this mistake is a PHEV being costed as an
// FBT-exempt EV, so the check runs both ways.
const PHEV_ONLY_FIELDS = [
  'combinedRangeKm', 'fuelConsumptionL100km', 'isFuelEfficientForLct', 'isGreenForVicDuty'
];

// A PHEV's battery and electric range are both far below anything a BEV
// could plausibly have, so one shared bound cannot serve both. rangeKm is
// electric range for every powertrain (for a BEV that is also its total),
// which is what keeps the batteryKwh/rangeKm consistency check below valid
// for both.
const PHEV_BOUNDS = {
  batteryKwh: [8, 60],
  rangeKm: [30, 200],
  combinedRangeKm: [300, 1500],
  fuelConsumptionL100km: [1, 15]
};

const boundsFor = (row, field) =>
  (powertrainOf(row) === 'phev' && PHEV_BOUNDS[field]) || NUMERIC_BOUNDS[field];

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

  const powertrain = powertrainOf(row);
  if (!POWERTRAINS.includes(powertrain)) {
    errors.push(`powertrain must be one of ${POWERTRAINS.join(', ')}, got ${row.powertrain}`);
  }

  const strayPhevFields = PHEV_ONLY_FIELDS.filter(f => row[f] !== undefined);
  if (powertrain !== 'phev' && strayPhevFields.length > 0) {
    errors.push(
      `${strayPhevFields.join(', ')} only belong on a plug-in hybrid — set powertrain: "phev" or remove them`
    );
  }
  if (powertrain === 'phev') {
    for (const field of ['combinedRangeKm', 'fuelConsumptionL100km']) {
      const value = row[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${field} must be a finite number on a plug-in hybrid`);
        continue;
      }
      const [min, max] = PHEV_BOUNDS[field];
      if (value < min || value > max) {
        errors.push(`${field} must be between ${min} and ${max}, got ${value}`);
      }
    }
    for (const field of ['isFuelEfficientForLct', 'isGreenForVicDuty']) {
      if (typeof row[field] !== 'boolean') {
        errors.push(`${field} must be true or false on a plug-in hybrid — it decides which tax rate applies`);
      }
    }
    if (
      typeof row.combinedRangeKm === 'number' && typeof row.rangeKm === 'number' &&
      row.combinedRangeKm <= row.rangeKm
    ) {
      errors.push(
        `combinedRangeKm (${row.combinedRangeKm}) must exceed rangeKm (${row.rangeKm}), which is the electric-only range`
      );
    }
  }

  for (const field of VEHICLE_NUMBERS) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${field} must be a finite number`);
      continue;
    }
    const [min, max] = boundsFor(row, field);
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

  const lists = { pros: 3, cons: 2, sources: 1 };
  for (const [field, minimum] of Object.entries(lists)) {
    if (!Array.isArray(entry[field]) || entry[field].length < minimum) {
      errors.push(`${field} must be an array of at least ${minimum}`);
    }
  }

  // images is optional: can be missing, can be empty, but if supplied must be valid
  if (Array.isArray(entry.images) && entry.images.length > 0) {
    if (entry.images.some(u => typeof u !== 'string' || !IMAGE_URL_RE.test(u))) {
      errors.push('images must all be https URLs ending in .jpg, .jpeg, .png or .webp');
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

  return { valid: errors.length === 0, errors };
}

export function loadDataset({ vehicles = [], families = [] } = {}) {
  // Coerce to empty arrays if not arrays
  const vehicleRows = Array.isArray(vehicles) ? vehicles : [];
  const familyEntries = Array.isArray(families) ? families : [];

  const skippedFamilies = [];
  const validFamilies = [];

  for (const entry of familyEntries) {
    const result = validateFamily(entry);
    if (result.valid) validFamilies.push(entry);
    else skippedFamilies.push({ id: entry?.id ?? 'unknown', errors: result.errors });
  }

  const familyIds = new Set(validFamilies.map(f => f.id));
  const seenVehicleIds = new Set();
  const skipped = [];
  const valid = [];

  for (const row of vehicleRows) {
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
