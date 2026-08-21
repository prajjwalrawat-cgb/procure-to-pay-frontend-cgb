/**
 * Code 128 (subset B) encoder.
 *
 * Written out rather than pulled from a package because it is a small, fixed,
 * fully-specified algorithm and the output has to be *right*: a label with one
 * wrong bar width is a sticker on a shelf that no scanner will ever read, and
 * nobody finds out until an operator is standing in front of it. Being able to
 * decode our own output in a test (see code128.test.ts) is worth more here than
 * a dependency.
 *
 * Subset B covers all of ASCII 32–126 — every character an internal location or
 * box code uses. Subset C would pack digit pairs more tightly; the extra width
 * is not worth the extra branch, since these codes are short.
 */

/**
 * The 107 symbol patterns. Each is the run-length of alternating bar/space
 * modules, starting with a bar: "212222" = bar 2, space 1, bar 2, space 2,
 * bar 2, space 2. Every symbol is 11 modules wide except the stop pattern,
 * which is 13.
 */
const PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

const START_B = 104;
const STOP = 106;

/** Values the encoder produced, useful for verifying an encoding in tests. */
export interface Code128Symbols {
  /** Symbol values: start, data…, checksum, stop. */
  values: number[];
  /** Module string: '1' = bar, '0' = space. */
  modules: string;
}

/** True when every character can be represented in subset B. */
export function isEncodableCode128(value: string): boolean {
  return [...value].every((c) => {
    const code = c.charCodeAt(0);
    return code >= 32 && code <= 126;
  });
}

/**
 * Encode a string to Code 128 subset B.
 *
 * The checksum is the weighted sum the spec defines: start value plus each data
 * value multiplied by its 1-based position, modulo 103. Scanners reject a
 * symbol whose checksum does not match, so an off-by-one here produces labels
 * that look perfect and never scan.
 */
export function encodeCode128(value: string): Code128Symbols {
  if (value.length === 0) throw new Error('Nothing to encode');
  if (!isEncodableCode128(value)) {
    throw new Error('Code 128 subset B supports printable ASCII only');
  }

  const data = [...value].map((c) => c.charCodeAt(0) - 32);
  let checksum = START_B;
  data.forEach((v, i) => {
    checksum += v * (i + 1);
  });
  checksum %= 103;

  const values = [START_B, ...data, checksum, STOP];
  const modules = values.map((v) => runsToModules(PATTERNS[v] as string)).join('');

  return { values, modules };
}

/** "212222" → "110011000110001100" — bars first, alternating. */
function runsToModules(pattern: string): string {
  let out = '';
  let bar = true;
  for (const ch of pattern) {
    out += (bar ? '1' : '0').repeat(Number(ch));
    bar = !bar;
  }
  return out;
}

export interface BarcodeSvgOptions {
  /** Width of one module in px. 2 is comfortable for a phone camera. */
  moduleWidth?: number;
  /** Bar height in px, excluding the caption. */
  height?: number;
  /**
   * Quiet zone in modules either side. The spec demands at least 10; without
   * it a scanner cannot find the symbol's edges and simply never decodes.
   */
  quietZone?: number;
}

/** Geometry for rendering, so React can draw rects without string surgery. */
export interface Code128Bars {
  width: number;
  height: number;
  /** Merged black runs — one rect per bar, not one per module. */
  bars: { x: number; width: number }[];
}

/**
 * Bar geometry for a value. Consecutive dark modules are merged into a single
 * rect: a printer given hundreds of abutting 2px rects can leave hairline gaps
 * between them, and a gap in the middle of a bar is a decode failure.
 */
export function code128Bars(value: string, options: BarcodeSvgOptions = {}): Code128Bars {
  const moduleWidth = options.moduleWidth ?? 2;
  const height = options.height ?? 60;
  const quietZone = options.quietZone ?? 10;

  const { modules } = encodeCode128(value);
  const width = (modules.length + quietZone * 2) * moduleWidth;

  const bars: { x: number; width: number }[] = [];
  let x = quietZone;
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === '1') {
      let run = 0;
      while (i + run < modules.length && modules[i + run] === '1') run += 1;
      bars.push({ x: x * moduleWidth, width: run * moduleWidth });
      x += run;
      i += run;
    } else {
      x += 1;
      i += 1;
    }
  }
  return { width, height, bars };
}

/**
 * Render a Code 128 barcode as a standalone SVG string.
 *
 * SVG rather than canvas so it prints at the printer's resolution — a canvas
 * bitmap scaled onto paper produces fuzzy bar edges, which is exactly what a
 * scanner struggles with.
 */
export function code128Svg(value: string, options: BarcodeSvgOptions = {}): string {
  const { width, height, bars } = code128Bars(value, options);
  const rects = bars
    .map(
      (b) =>
        `<rect x="${b.x.toFixed(2)}" y="0" width="${b.width.toFixed(2)}" height="${height}" fill="#000"/>`,
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">` +
    `<rect width="${width}" height="${height}" fill="#fff"/>${rects}</svg>`
  );
}
