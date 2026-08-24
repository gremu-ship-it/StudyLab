import { describe, expect, it } from "vitest";
import {
  ACTIVITY_REGISTRY,
  listActivities,
  mulberry32,
} from "../src/lib/practical-activities";

describe("mulberry32 PRNG", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });

  it("produces values in [0,1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("equation_balance", () => {
  const act = ACTIVITY_REGISTRY["equation_balance"];

  it("accepts the known solution for a fixed scenario", () => {
    const s = { lhs: "H2 + O2", rhs: "H2O" };
    const fields = act.fields(s);
    const answers: Record<string, string> = {};
    for (const f of fields) answers[f.key] = "1";
    answers["c_H2"] = "2";
    answers["c_O2"] = "1";
    answers["c_H2O"] = "2";
    const r = act.check(s, answers);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(100);
  });

  it("gives 50 (not 100) for balanced-but-not-lowest-terms", () => {
    const s = { lhs: "H2 + O2", rhs: "H2O" };
    const r = act.check(s, { c_H2: "4", c_O2: "2", c_H2O: "4" });
    expect(r.correct).toBe(false);
    expect(r.score).toBe(50);
    expect(r.feedback).toMatch(/smallest/i);
  });

  it("points at the mismatched element when unbalanced", () => {
    const s = { lhs: "H2 + O2", rhs: "H2O" };
    const r = act.check(s, { c_H2: "1", c_O2: "1", c_H2O: "1" });
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
    expect(r.feedback).toMatch(/O/);
  });

  it("rejects non-positive or missing coefficients", () => {
    const s = { lhs: "CH4 + O2", rhs: "CO2 + H2O" };
    expect(act.check(s, { c_CH4: "1", c_O2: "", c_CO2: "1", c_H2O: "2" }).score).toBe(0);
    expect(act.check(s, { c_CH4: "0", c_O2: "2", c_CO2: "1", c_H2O: "2" }).score).toBe(0);
  });

  it("scenarios are valid reactions (solution balances)", () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = act.makeScenario(mulberry32(seed));
      const lhs = String(s.lhs).split(" + ");
      const rhs = String(s.rhs).split(" + ");
      // brute force: the stored known solution exists in REACTIONS; instead
      // verify structure: every formula parses into at least one element and
      // a balanced solution can be found within small coefficients.
      const all = [...lhs, ...rhs];
      const atoms = (f: string): Record<string, number> => {
        const out: Record<string, number> = {};
        const re = /([A-Z][a-z]?)(\d*)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(f)) !== null) if (m[1]) out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? +m[2] : 1);
        return out;
      };
      const counts: Record<string, number>[] = all.map(atoms);
      let found = false;
      for (let a = 1; a <= 10 && !found; a++)
        for (let b = 1; b <= 10 && !found; b++)
          for (let c = 1; c <= 10 && !found; c++)
            for (let d = 1; d <= 10 && !found; d++) {
              const coeff = [a, b, c, d].slice(0, all.length);
              const L: Record<string, number> = {}, R: Record<string, number> = {};
              lhs.forEach((f, i) => {
                for (const [el, n] of Object.entries(counts[i])) L[el] = (L[el] ?? 0) + n * coeff[i];
              });
              rhs.forEach((f, i) => {
                for (const [el, n] of Object.entries(counts[lhs.length + i])) R[el] = (R[el] ?? 0) + n * coeff[lhs.length + i];
              });
              const norm = (o: Record<string, number>) =>
                Object.keys(o)
                  .sort()
                  .map((k) => `${k}:${o[k]}`)
                  .join("|");
              found = norm(L) === norm(R);
            }
      expect(found, `seed ${seed}: ${s.lhs} → ${s.rhs}`).toBe(true);
    }
  });
});

describe("break_even", () => {
  const act = ACTIVITY_REGISTRY["break_even"];

  it("scenarios always yield an integer break-even", () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = act.makeScenario(mulberry32(seed));
      const beq = Number(s.fixed_cost) / (Number(s.price_per_unit) - Number(s.variable_cost));
      expect(Number.isInteger(beq)).toBe(true);
      expect(beq).toBeGreaterThanOrEqual(50);
    }
  });

  it("accepts the exact answer and rejects a wrong one", () => {
    const s = act.makeScenario(mulberry32(5));
    const beq = Number(s.fixed_cost) / (Number(s.price_per_unit) - Number(s.variable_cost));
    expect(act.check(s, { beq: String(beq) }).correct).toBe(true);
    const wrong = act.check(s, { beq: String(beq + 5) });
    expect(wrong.correct).toBe(false);
    expect(wrong.solution).toMatch(/BEQ =/);
  });
});

describe("unit_conversion", () => {
  const act = ACTIVITY_REGISTRY["unit_conversion"];

  it("m/s → km/h converts by 3.6", () => {
    const s = { value: 10, from: "m/s", to: "km/h" };
    expect(act.check(s, { converted: "36" }).correct).toBe(true);
    expect(act.check(s, { converted: "10" }).correct).toBe(false);
  });

  it("kg → g and its inverse", () => {
    expect(act.check({ value: 2, from: "kg", to: "g" }, { converted: "2000" }).correct).toBe(true);
    expect(act.check({ value: 250, from: "g", to: "kg" }, { converted: "0.25" }).correct).toBe(true);
  });

  it("scenarios produce sane targets", () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = act.makeScenario(mulberry32(seed));
      const factor =
        s.from === "m/s" && s.to === "km/h" ? 3.6 :
        s.from === "km/h" && s.to === "m/s" ? 1 / 3.6 :
        s.from === "kg" && s.to === "g" ? 1000 :
        s.from === "g" && s.to === "kg" ? 0.001 :
        s.from === "m" && s.to === "cm" ? 100 :
        s.from === "cm" && s.to === "m" ? 0.01 :
        s.from === "kPa" && s.to === "Pa" ? 1000 : 0.001;
      const target = Number(s.value) * factor;
      expect(target).toBeGreaterThan(0);
    }
  });
});

describe("linear_rate", () => {
  const act = ACTIVITY_REGISTRY["linear_rate"];

  it("accepts the true slope and intercept", () => {
    const s = { x1: 1, y1: 5, x2: 4, y2: 14 }; // m=3, b=2
    const r = act.check(s, { slope: "3", intercept: "2" });
    expect(r.correct).toBe(true);
    expect(r.score).toBe(100);
    expect(r.solution).toMatch(/y = 3x/);
  });

  it("scores partial credit when only the slope is right", () => {
    const s = { x1: 1, y1: 5, x2: 4, y2: 14 };
    const r = act.check(s, { slope: "3", intercept: "9" });
    expect(r.correct).toBe(false);
    expect(r.score).toBe(50);
    expect(r.feedback).toMatch(/slope is right/i);
  });

  it("scenarios are integer-valued lines", () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = act.makeScenario(mulberry32(seed));
      const m = (Number(s.y2) - Number(s.y1)) / (Number(s.x2) - Number(s.x1));
      expect(Number.isInteger(m)).toBe(true);
      expect(Number(s.x1)).not.toBe(Number(s.x2));
    }
  });
});

describe("registry", () => {
  it("exposes all four built-ins with unique types", () => {
    const acts = listActivities();
    expect(acts.map((a) => a.type).sort()).toEqual([
      "break_even",
      "equation_balance",
      "linear_rate",
      "unit_conversion",
    ]);
    for (const a of acts) {
      expect(a.subject.length).toBeGreaterThan(0);
      expect(a.blurb.length).toBeGreaterThan(0);
    }
  });
});
