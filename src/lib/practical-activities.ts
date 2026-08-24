// StudyLab — Practical learning activity registry (Phase 9).
// ------------------------------------------------------------------
// Deterministic, extensible built-in practical activities with REAL logic
// (no AI, no fake grading). Each activity:
//   * generates a scenario from a seeded PRNG (reproducible in tests),
//   * collects student answers,
//   * grades them exactly and explains the worked solution.
//
// The registry is open: add an ActivityDef to ACTIVITY_REGISTRY and it
// appears in the Practicals tab. Subjects are data, not hard-coded UI.

// ---------- deterministic PRNG (mulberry32) ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Scenario = Record<string, string | number>;

export interface ActivityField {
  key: string;
  label: string;
  placeholder?: string;
}

export interface ActivityResult {
  correct: boolean;
  score: number; // 0..100
  feedback: string; // shown immediately, honest about what was right/wrong
  solution: string; // full worked solution (revealed after checking)
}

export interface ActivityDef {
  type: string;
  subject: string;
  title: string;
  blurb: string;
  makeScenario: (rng: () => number) => Scenario;
  fields: (scenario: Scenario) => ActivityField[];
  check: (scenario: Scenario, answers: Record<string, string>) => ActivityResult;
}

const int = (rng: () => number, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

const close = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;

// ---------- 1. Chemistry: equation balancer ----------

interface Reaction {
  lhs: string[]; // formulas left of the arrow, e.g. ["H2", "O2"]
  rhs: string[];
  solution: number[]; // coefficients covering lhs then rhs (lowest terms)
  note?: string;
}

const REACTIONS: Reaction[] = [
  { lhs: ["H2", "O2"], rhs: ["H2O"], solution: [2, 1, 2] },
  { lhs: ["Na", "Cl2"], rhs: ["NaCl"], solution: [2, 1, 2] },
  { lhs: ["Fe", "O2"], rhs: ["Fe2O3"], solution: [4, 3, 2] },
  { lhs: ["CH4", "O2"], rhs: ["CO2", "H2O"], solution: [1, 2, 1, 2] },
  { lhs: ["C3H8", "O2"], rhs: ["CO2", "H2O"], solution: [1, 5, 3, 4] },
  { lhs: ["Al", "O2"], rhs: ["Al2O3"], solution: [4, 3, 2] },
  { lhs: ["K", "Cl2"], rhs: ["KCl"], solution: [2, 1, 2] },
  { lhs: ["Mg", "O2"], rhs: ["MgO"], solution: [2, 1, 2] },
  { lhs: ["N2", "H2"], rhs: ["NH3"], solution: [1, 3, 2] },
  { lhs: ["C2H6", "O2"], rhs: ["CO2", "H2O"], solution: [2, 7, 4, 6] },
];

/** Parse "Fe2O3" → { Fe: 2, O: 3 } (uppercase + optional lowercase element). */
function countAtoms(formula: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    if (!m[1]) continue;
    out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? parseInt(m[2], 10) : 1);
  }
  return out;
}

function totalAtoms(side: string[], coeffs: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  side.forEach((f, i) => {
    for (const [el, n] of Object.entries(countAtoms(f))) {
      out[el] = (out[el] ?? 0) + n * coeffs[i];
    }
  });
  return out;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function gcdAll(ns: number[]): number {
  return ns.reduce((a, b) => gcd(a, b), 0);
}

function sidesEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

const equationBalance: ActivityDef = {
  type: "equation_balance",
  subject: "Chemistry",
  title: "Balance the equation",
  blurb: "Enter the smallest whole-number coefficients that balance the reaction.",
  makeScenario: (rng) => {
    const r = REACTIONS[int(rng, 0, REACTIONS.length - 1)];
    return { lhs: r.lhs.join(" + "), rhs: r.rhs.join(" + ") };
  },
  fields: (s) => {
    const parts = `${s.lhs} + ${s.rhs}`.split(" + ");
    return parts.map((p) => ({ key: `c_${p}`, label: `Coefficient of ${p}`, placeholder: "e.g. 2" }));
  },
  check: (s, answers) => {
    const lhs = String(s.lhs).split(" + ");
    const rhs = String(s.rhs).split(" + ");
    const all = [...lhs, ...rhs];
    const coeffs = all.map((f) => {
      const v = Math.trunc(Number(answers[`c_${f}`] ?? ""));
      return Number.isFinite(v) && v > 0 ? v : NaN;
    });
    if (coeffs.some((c) => Number.isNaN(c))) {
      return {
        correct: false,
        score: 0,
        feedback: "Enter a positive whole number for every compound before checking.",
        solution: "",
      };
    }
    const L = totalAtoms(lhs, coeffs.slice(0, lhs.length));
    const R = totalAtoms(rhs, coeffs.slice(lhs.length));
    if (sidesEqual(L, R)) {
      const g = gcdAll(coeffs);
      if (g === 1) {
        return {
          correct: true,
          score: 100,
          feedback: `Balanced and in lowest terms: ${lhs.map((f, i) => (coeffs[i] === 1 ? f : `${coeffs[i]}${f}`)).join(" + ")} → ${rhs.map((f, i) => (coeffs[lhs.length + i] === 1 ? f : `${coeffs[lhs.length + i]}${f}`)).join(" + ")}.`,
          solution: `Atom counts — LHS ${describe(L)} = RHS ${describe(R)}. GCD of the coefficients is 1, so the ratio is already in lowest terms.`,
        };
      }
      const lowest = coeffs.map((c) => c / g);
      return {
        correct: false,
        score: 50,
        feedback: `Your coefficients balance the equation, but they are not the smallest whole numbers (divide all by ${g}).`,
        solution: `Lowest terms: ${lowest.join(" : ")}.`,
      };
    }
    // Point at the first mismatched element.
    const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
    const bad = [...keys].find((k) => (L[k] ?? 0) !== (R[k] ?? 0));
    return {
      correct: false,
      score: 0,
      feedback:
        bad != null
          ? `Not balanced yet — ${bad} appears ${L[bad] ?? 0}× on the left but ${R[bad] ?? 0}× on the right.`
          : "Not balanced yet. Count each element on both sides.",
      solution: "",
    };
  },
};

function describe(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([el, n]) => `${el} ${n}`)
    .join(", ");
}

// ---------- 2. Ag-econ: break-even calculator ----------

const breakEven: ActivityDef = {
  type: "break_even",
  subject: "Agribusiness Economics",
  title: "Break-even quantity",
  blurb: "Find the output level where total revenue equals total cost.",
  makeScenario: (rng) => {
    const unit = int(rng, 2, 9); // price − variable cost
    const beq = int(rng, 50, 400);
    const variable = int(rng, 10, 90);
    const price = variable + unit;
    const fixed = beq * unit;
    return { fixed_cost: fixed, price_per_unit: price, variable_cost: variable, unit: "units" };
  },
  fields: () => [{ key: "beq", label: "Break-even quantity (units)", placeholder: "e.g. 200" }],
  check: (s, answers) => {
    const fixed = Number(s.fixed_cost);
    const price = Number(s.price_per_unit);
    const varCost = Number(s.variable_cost);
    const beq = fixed / (price - varCost);
    const given = Number(answers["beq"]);
    const ok = Number.isFinite(given) && close(given, beq, 0.5);
    return {
      correct: ok,
      score: ok ? 100 : 0,
      feedback: ok
        ? `Correct — at ${beq} units, revenue (${beq} × ${price}) just covers fixed costs (${fixed}) plus variable costs.`
        : "Check the break-even formula: BEQ = fixed costs ÷ (price − variable cost per unit).",
      solution: `BEQ = ${fixed} ÷ (${price} − ${varCost}) = ${fixed} ÷ ${price - varCost} = ${beq} units. Below ${beq} units the farm loses money; above it, each unit adds ${price - varCost} to profit.`,
    };
  },
};

// ---------- 3. Physics: unit converter ----------

const CONVERSIONS: { from: string; to: string; factor: number }[] = [
  { from: "m/s", to: "km/h", factor: 3.6 },
  { from: "km/h", to: "m/s", factor: 1 / 3.6 },
  { from: "kg", to: "g", factor: 1000 },
  { from: "g", to: "kg", factor: 0.001 },
  { from: "m", to: "cm", factor: 100 },
  { from: "cm", to: "m", factor: 0.01 },
  { from: "kPa", to: "Pa", factor: 1000 },
  { from: "N", to: "kN", factor: 0.001 },
];

const unitConversion: ActivityDef = {
  type: "unit_conversion",
  subject: "Physics",
  title: "Convert the units",
  blurb: "Convert the value into the requested unit.",
  makeScenario: (rng) => {
    const c = CONVERSIONS[int(rng, 0, CONVERSIONS.length - 1)];
    // Pick a value that stays clean after conversion where possible.
    const value = int(rng, 2, 90) * (c.factor < 1 ? 1 / c.factor : 1);
    return { value, from: c.from, to: c.to };
  },
  fields: (s) => [{ key: "converted", label: `Value in ${s.to}`, placeholder: "your answer" }],
  check: (s, answers) => {
    const c = CONVERSIONS.find((x) => x.from === s.from && x.to === s.to);
    if (!c) return { correct: false, score: 0, feedback: "Unknown conversion.", solution: "" };
    const target = Number(s.value) * c.factor;
    const given = Number(answers["converted"]);
    const ok = Number.isFinite(given) && close(given, target, Math.max(0.01, target * 0.005));
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));
    return {
      correct: ok,
      score: ok ? 100 : 0,
      feedback: ok
        ? `Correct — ${s.value} ${s.from} = ${fmt(target)} ${s.to}.`
        : `Multiply by the conversion factor ${c.factor < 1 ? `1/${fmt(1 / c.factor)}` : fmt(c.factor)}: check the size of your answer.`,
      solution: `${s.value} ${s.from} × ${fmt(c.factor)} = ${fmt(target)} ${s.to}.`,
    };
  },
};

// ---------- 4. Calculus/Physics: rate of change from two points ----------

const linearRate: ActivityDef = {
  type: "linear_rate",
  subject: "Calculus",
  title: "Rate of change (slope & intercept)",
  blurb: "Given two points on a straight line, find its rate of change and value at x = 0.",
  makeScenario: (rng) => {
    const m = int(rng, -6, 6) || 2;
    const b = int(rng, -12, 12);
    const x1 = int(rng, 0, 8);
    let x2 = x1 + int(rng, 2, 5);
    if (x2 > 10) x2 = x1 + 2;
    return { x1, y1: m * x1 + b, x2, y2: m * x2 + b };
  },
  fields: () => [
    { key: "slope", label: "Rate of change (m)" },
    { key: "intercept", label: "Value at x = 0 (b)" },
  ],
  check: (s, answers) => {
    const x1 = Number(s.x1), y1 = Number(s.y1), x2 = Number(s.x2), y2 = Number(s.y2);
    const m = (y2 - y1) / (x2 - x1);
    const b = y1 - m * x1;
    const gm = Number(answers["slope"]);
    const gb = Number(answers["intercept"]);
    const okM = Number.isFinite(gm) && close(gm, m, 0.5);
    const okB = Number.isFinite(gb) && close(gb, b, 0.5);
    const score = (okM ? 50 : 0) + (okB ? 50 : 0);
    return {
      correct: okM && okB,
      score,
      feedback:
        score === 100
          ? `Correct — the line rises ${m} for every 1 unit of x and crosses the y-axis at ${b}.`
          : [
              okM ? "Slope is right." : "Slope is off — slope = (y₂ − y₁) ÷ (x₂ − x₁).",
              okB ? "Intercept is right." : "Intercept is off — b = y₁ − m·x₁.",
            ]
            .filter(Boolean)
            .join(" "),
      solution: `m = (${y2} − ${y1}) ÷ (${x2} − ${x1}) = ${m};  b = ${y1} − ${m} × ${x1} = ${b}. Line: y = ${m}x ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`}.`,
    };
  },
};

// ---------- registry ----------

export const ACTIVITY_REGISTRY: Record<string, ActivityDef> = {
  equation_balance: equationBalance,
  break_even: breakEven,
  unit_conversion: unitConversion,
  linear_rate: linearRate,
};

export function listActivities(): ActivityDef[] {
  return Object.values(ACTIVITY_REGISTRY);
}
