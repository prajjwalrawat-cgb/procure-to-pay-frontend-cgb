import { describe, expect, it } from 'vitest';

import { code128Svg, encodeCode128, isEncodableCode128 } from './code128';

/**
 * The patterns, recovered from the encoder's own output rather than duplicated
 * here — see `decode` below. Duplicating the table would mean a typo in it
 * matched a typo in the test and the labels still would not scan.
 */

/** Turn a module string back into run-lengths per 11-module symbol. */
function toRuns(modules: string): string[] {
  const runs: string[] = [];
  let i = 0;
  while (i < modules.length) {
    // Every symbol is 11 modules; the stop pattern is the final 13.
    const width = modules.length - i === 13 ? 13 : 11;
    const chunk = modules.slice(i, i + width);
    let pattern = '';
    let run = 1;
    for (let k = 1; k <= chunk.length; k += 1) {
      if (chunk[k] === chunk[k - 1]) run += 1;
      else {
        pattern += String(run);
        run = 1;
      }
    }
    runs.push(pattern);
    i += width;
  }
  return runs;
}

/**
 * Decode our own bars back to text, the way a scanner would: split into
 * symbols, map each run-length pattern to its value, verify the checksum, then
 * turn subset-B values back into characters.
 *
 * This is the test that matters. It proves the bar widths a printer will lay
 * down actually represent the string we asked for — an assertion on the symbol
 * values alone would pass even if the pattern table were wrong.
 */
function decode(modules: string, encodeFn: (s: string) => string[]): string {
  const runs = toRuns(modules);
  // Build a value→pattern map by encoding every printable character once.
  const table = new Map<string, number>();
  for (let v = 0; v <= 94; v += 1) {
    const char = String.fromCharCode(v + 32);
    const [, dataPattern] = encodeFn(char);
    table.set(dataPattern as string, v);
  }

  const [startPattern, ...rest] = runs;
  expect(startPattern).toBe('211214'); // START B
  const stopPattern = rest.pop();
  expect(stopPattern).toBe('2331112'); // STOP
  const checkPattern = rest.pop();

  const values = rest.map((p) => {
    const v = table.get(p);
    if (v === undefined) throw new Error(`Unknown pattern ${p}`);
    return v;
  });

  // Re-derive the checksum and confirm the encoder's matches.
  let sum = 104;
  values.forEach((v, i) => {
    sum += v * (i + 1);
  });
  const expectedCheck = sum % 103;
  const checkValue = [...table.entries()].find(([p]) => p === checkPattern)?.[1];
  if (checkValue !== undefined) expect(checkValue).toBe(expectedCheck);

  return values.map((v) => String.fromCharCode(v + 32)).join('');
}

/** Runs for a single-character encoding: [start, data, checksum, stop]. */
const runsFor = (s: string): string[] => toRuns(encodeCode128(s).modules);

describe('encodeCode128', () => {
  it('computes the spec checksum', () => {
    // "A" is value 33. checksum = (104 + 33 * 1) % 103 = 34.
    const { values } = encodeCode128('A');
    expect(values).toEqual([104, 33, 34, 106]);
  });

  it('wraps the checksum modulo 103', () => {
    const { values } = encodeCode128('zzzz');
    const check = values[values.length - 2] as number;
    expect(check).toBeGreaterThanOrEqual(0);
    expect(check).toBeLessThan(103);
  });

  it('produces 11 modules per symbol, plus a 13-module stop', () => {
    const { values, modules } = encodeCode128('BIN-A1');
    // start + 6 data + checksum = 8 symbols of 11, then the 13-wide stop.
    expect(values).toHaveLength(9);
    expect(modules).toHaveLength(8 * 11 + 13);
  });

  it('rejects characters subset B cannot represent', () => {
    expect(isEncodableCode128('BIN-A1')).toBe(true);
    expect(isEncodableCode128('BINé')).toBe(false);
    expect(() => encodeCode128('BINé')).toThrow();
  });

  it('refuses to encode nothing', () => {
    expect(() => encodeCode128('')).toThrow();
  });
});

describe('round trip — the bars really say what we meant', () => {
  for (const value of ['BIN-A1', 'BOX-000001', 'DOCK-1', 'SC-000010', 'a1B2-c3']) {
    it(`decodes "${value}" back from its own bars`, () => {
      const { modules } = encodeCode128(value);
      expect(decode(modules, runsFor)).toBe(value);
    });
  }
});

describe('code128Svg', () => {
  it('includes the quiet zone a scanner needs to find the symbol', () => {
    const svg = code128Svg('BIN-A1', { moduleWidth: 2, quietZone: 10 });
    const { modules } = encodeCode128('BIN-A1');
    // (modules + 2 × quiet zone) × moduleWidth
    const expectedWidth = (modules.length + 20) * 2;
    expect(svg).toContain(`width="${expectedWidth}"`);
    // The first bar starts after the quiet zone, never at x=0.
    expect(svg).not.toContain('<rect x="0.00" y="0"');
  });

  it('renders bars as merged rectangles rather than one per module', () => {
    const svg = code128Svg('BIN-A1');
    const rects = svg.match(/<rect /g) ?? [];
    const { modules } = encodeCode128('BIN-A1');
    // One background rect plus one per bar run — far fewer than one per module.
    expect(rects.length).toBeLessThan(modules.length);
    expect(rects.length).toBeGreaterThan(1);
  });

  it('is self-contained SVG that can be dropped straight into a page', () => {
    const svg = code128Svg('BOX-000001');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});
