// calc/spec-compare.js — the specification comparison behind the Compare tab.
//
// Pure, like everything else in calc/: it takes two or three vehicle rows plus
// the tax tables and returns grouped rows carrying raw values, a winner index
// and any caveats. It does no formatting and touches no DOM, so it runs
// identically under the Node test runner and in the browser.
//
// Formatting deliberately lives in the UI layer (public/ui/compare-tab.js).
// money() is in public/ui/format.js, and importing it here would point calc/
// at public/ — the one dependency direction this codebase does not have.

import { driveAwayPrice } from './onroad.js';

const powertrainOf = v => v.powertrain ?? 'bev';

// A PHEV's rangeKm is electric-only (43-183km across the dataset) where a
// BEV's is the whole trip. combinedRangeKm exists only on a PHEV. Splitting
// range into two rows means each row is genuinely like for like, and the
// caveat only has to explain what "total" assumes.
const totalRangeOf = v =>
  powertrainOf(v) === 'phev' ? v.combinedRangeKm : v.rangeKm;

export const ROW_GROUPS = [
  { key: 'price', label: 'Price' },
  { key: 'practicality', label: 'Practicality' },
  { key: 'energy', label: 'Energy' },
  { key: 'ownership', label: 'Ownership' }
];

// direction: 'higher' | 'lower' | null. null means the row is descriptive and
// no winner is ever marked — more seats is not better, and a body type has no
// ordering at all.
//
// omitWhen lets a row disappear rather than print a column of em-dashes: a
// petrol figure among three battery-electric cars is noise, not information.
const ROW_SPECS = [
  {
    group: 'price', key: 'listPrice', label: 'List price',
    unit: '', format: 'money', direction: 'lower', value: v => v.listPrice
  },
  {
    group: 'price', key: 'driveAway', label: 'Drive-away (Vic, est.)',
    unit: '', format: 'money', direction: 'lower',
    // Every flag defaults the way data/schema.js says an absent one should:
    // a row without them is a BEV, which is green and fuel-efficient and is
    // not a goods vehicle.
    value: (v, tables) => driveAwayPrice({
      listPrice: v.listPrice,
      isGreen: v.isGreenForVicDuty ?? true,
      isFuelEfficient: v.isFuelEfficientForLct ?? true,
      isNonPassenger: v.isNonPassengerForVicDuty ?? false
    }, tables).total
  },
  {
    group: 'price', key: 'underThreshold', label: 'Under the $91,661 threshold',
    unit: '', format: 'text', direction: null,
    // A plain price test. It must NOT call fbtTreatment (calc/fbt.js), which
    // needs a lease start date — an input this tab deliberately does not have.
    value: (v, tables) => v.listPrice <= tables.lct.fuelEfficientThreshold ? 'Yes' : 'No'
  },
  {
    group: 'price', key: 'resale5yr', label: 'Resale after 5 years',
    unit: '', format: 'percent', direction: 'higher',
    value: v => v.depreciationCurve[5] ?? null
  },

  {
    group: 'practicality', key: 'bodyType', label: 'Body type',
    unit: '', format: 'text', direction: null, value: v => v.bodyType
  },
  {
    group: 'practicality', key: 'seats', label: 'Seats',
    unit: '', format: 'integer', direction: null, value: v => v.seats
  },
  {
    group: 'practicality', key: 'bootUp', label: 'Boot, seats up',
    unit: 'L', format: 'integer', direction: 'higher', value: v => v.bootLitresSeatsUp
  },
  {
    group: 'practicality', key: 'bootDown', label: 'Boot, seats down',
    unit: 'L', format: 'integer', direction: 'higher', value: v => v.bootLitresSeatsDown
  },
  {
    group: 'practicality', key: 'towKg', label: 'Braked towing',
    unit: 'kg', format: 'integer', direction: 'higher', value: v => v.towKg
  },

  {
    group: 'energy', key: 'powertrain', label: 'Powertrain',
    unit: '', format: 'text', direction: null,
    value: v => powertrainOf(v) === 'phev' ? 'Plug-in hybrid' : 'Battery electric'
  },
  {
    group: 'energy', key: 'electricRange', label: 'Electric range',
    unit: 'km', format: 'integer', direction: 'higher', value: v => v.rangeKm
  },
  {
    group: 'energy', key: 'totalRange', label: 'Total range',
    unit: 'km', format: 'integer', direction: 'higher', value: totalRangeOf
  },
  {
    group: 'energy', key: 'batteryKwh', label: 'Battery',
    unit: 'kWh', format: 'decimal1', direction: 'higher', value: v => v.batteryKwh
  },
  {
    group: 'energy', key: 'energyUse', label: 'Energy use',
    unit: 'kWh/100km', format: 'decimal1', direction: 'lower',
    value: v => v.consumptionKwhPer100km
  },
  {
    group: 'energy', key: 'petrolUse', label: 'Petrol use',
    unit: 'L/100km', format: 'decimal1', direction: 'lower',
    value: v => v.fuelConsumptionL100km ?? null,
    omitWhen: vehicles => !vehicles.some(v => powertrainOf(v) === 'phev')
  },

  {
    group: 'ownership', key: 'warrantyYears', label: 'Warranty',
    unit: 'years', format: 'integer', direction: 'higher', value: v => v.warrantyYears
  },
  {
    group: 'ownership', key: 'insuranceAnnual', label: 'Insurance (est. annual)',
    unit: '', format: 'money', direction: 'lower', value: v => v.insuranceAnnual
  },
  {
    group: 'ownership', key: 'sourcedAt', label: 'Data sourced',
    unit: '', format: 'text', direction: null, value: v => v.sourcedAt
  }
];

// --- Caveats ---------------------------------------------------------------
//
// The dataset has no missing values, so the hard part of comparing two cars is
// never a gap — it is that the same field can mean different things. A PHEV's
// rangeKm is electric-only where a BEV's is the whole trip; a ute's boot is an
// open tray that gains nothing from folding the rear seats; being under
// $91,661 buys a BEV an FBT exemption and buys a PHEV nothing.
//
// Every rule below is derived from the data. None is written per car.

const displayName = v => `${v.make} ${v.model}`;

// "the Sealion 6 and the Ranger". Never more than three, so no cleverness.
function nameList(names) {
  if (names.length === 1) return `the ${names[0]}`;
  if (names.length === 2) return `the ${names[0]} and the ${names[1]}`;
  return `the ${names.slice(0, -1).join(', the ')} and the ${names[names.length - 1]}`;
}

const isUte = v => v.bodyType === 'Ute';
const isPhev = v => powertrainOf(v) === 'phev';

// Ordered most specific first. bootDown can attract three of these at once,
// and the renderer shows only the first two — the specific wording subsumes
// the general, so "that is an open tray" should outrank "seat counts differ".
export const CAVEAT_PRECEDENCE = [
  'ute-vs-other', 'ute-present', 'mixed-seats', 'mixed-powertrain', 'phev-present'
];

const CAVEAT_RULES = [
  {
    id: 'mixed-powertrain',
    rows: ['totalRange', 'batteryKwh', 'energyUse', 'petrolUse'],
    applies: vehicles => vehicles.some(isPhev) && vehicles.some(v => !isPhev(v)),
    text: (vehicles, rowKey) => {
      const phevs = vehicles.filter(isPhev);
      const names = nameList(phevs.map(displayName));
      const isAre = phevs.length === 1 ? 'is' : 'are';
      const verbS = phevs.length === 1 ? 's' : '';
      // "is a plug-in hybrid" / "are plug-in hybrids" — the noun has to agree
      // in number too, not just the verb, once a set holds two-plus PHEVs.
      const hybridNoun = phevs.length === 1 ? 'a plug-in hybrid' : 'plug-in hybrids';
      if (rowKey === 'totalRange') {
        const detail = phevs
          .map(v => `${displayName(v)} ${v.rangeKm}km`)
          .join(', ');
        return `Not like for like — ${names} ${isAre} ${hybridNoun}, so this total ` +
          `assumes a full tank as well as a full battery. On battery alone: ${detail}.`;
      }
      if (rowKey === 'batteryKwh') {
        return `Not like for like — a plug-in hybrid's battery does a different job. ` +
          `${names.charAt(0).toUpperCase()}${names.slice(1)} ${isAre} sized to cover a ` +
          `commute, not the whole trip.`;
      }
      if (rowKey === 'energyUse') {
        return `Not like for like — for ${names} this is electric-mode consumption only. ` +
          `The petrol figure is on the row below.`;
      }
      return `Not like for like — only ${names} burn${verbS} petrol. A battery-electric ` +
        `car has no figure here.`;
    }
  },
  {
    id: 'phev-present',
    rows: ['underThreshold'],
    // Deliberately not folded into mixed-powertrain: an all-PHEV comparison
    // would otherwise read "Yes" with no caveat, implying an exemption that
    // no plug-in hybrid has had since 1 April 2025.
    applies: vehicles => vehicles.some(isPhev),
    text: vehicles => {
      const names = nameList(vehicles.filter(isPhev).map(displayName));
      return `Under $91,661 means no luxury car tax. It does not mean a novated-lease ` +
        `FBT exemption for ${names} — plug-in hybrids lost that on 1 April 2025.`;
    }
  },
  {
    id: 'ute-vs-other',
    rows: ['bootUp', 'bootDown'],
    applies: vehicles => vehicles.some(isUte) && vehicles.some(v => !isUte(v)),
    text: vehicles => {
      const utes = vehicles.filter(isUte);
      const names = nameList(utes.map(displayName));
      const verb = utes.length === 1 ? 'measures' : 'measure';
      return `Not like for like — ${names} ${verb} an open tray, not an enclosed boot.`;
    }
  },
  {
    id: 'ute-present',
    rows: ['bootDown'],
    applies: vehicles => vehicles.some(isUte),
    text: () =>
      `Every ute in the dataset lists the same figure seats up and seats down — a tray ` +
      `gains nothing from folding the rear seats, so this row is not the comparison it looks like.`
  },
  {
    id: 'mixed-seats',
    rows: ['bootUp', 'bootDown'],
    applies: vehicles => new Set(vehicles.map(v => v.seats)).size > 1,
    text: vehicles => {
      const counts = [...new Set(vehicles.map(v => v.seats))].sort((a, b) => a - b).join(' and ');
      return `Not like for like — these cars seat ${counts}, so the litres are measured ` +
        `behind different rows of seats.`;
    }
  }
];

function caveatsFor(rowKey, vehicles) {
  return CAVEAT_PRECEDENCE
    .map(id => CAVEAT_RULES.find(rule => rule.id === id))
    .filter(rule => rule.rows.includes(rowKey) && rule.applies(vehicles))
    .map(rule => ({ id: rule.id, text: rule.text(vehicles, rowKey) }));
}

// A winner needs a direction, real numbers, and an outright best. A tie means
// no winner: marking one of two identical figures would invent a difference.
function pickWinner(values, direction) {
  if (!direction) return null;
  const numeric = values
    .map((value, index) => ({ value, index }))
    .filter(entry => typeof entry.value === 'number' && Number.isFinite(entry.value));
  if (numeric.length < 2) return null;

  const better = direction === 'higher'
    ? (a, b) => a > b
    : (a, b) => a < b;

  let best = numeric[0];
  let tied = false;
  for (const entry of numeric.slice(1)) {
    if (better(entry.value, best.value)) {
      best = entry;
      tied = false;
    } else if (entry.value === best.value) {
      tied = true;
    }
  }
  return tied ? null : best.index;
}

export function comparisonRows(vehicles, tables) {
  const specs = ROW_SPECS.filter(spec => !spec.omitWhen?.(vehicles));

  const rows = specs.map(spec => {
    const values = vehicles.map(vehicle => spec.value(vehicle, tables));
    const caveats = caveatsFor(spec.key, vehicles);
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      format: spec.format,
      values,
      // If the numbers cannot be read straight across, neither can a "best".
      // Marking one anyway is how a comparison tool tells its first lie.
      winnerIndex: caveats.length > 0 ? null : pickWinner(values, spec.direction),
      caveats
    };
  });

  return {
    groups: ROW_GROUPS.map(group => ({
      ...group,
      rows: rows.filter(row => specs.find(s => s.key === row.key).group === group.key)
    }))
  };
}
