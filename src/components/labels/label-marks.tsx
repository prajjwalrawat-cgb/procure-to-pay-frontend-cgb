'use client';

import QRCode from 'qrcode';

import { code128Bars } from '@/lib/labels/code128';

/**
 * The two mark types a warehouse label can carry.
 *
 * Both render as inline SVG so they print at the printer's own resolution.
 * A rasterised barcode scaled onto paper gets soft bar edges, and soft edges
 * are precisely what makes a scanner hesitate under warehouse lighting.
 */

/** A 1D Code 128 barcode — compact, fits a shelf-edge strip. */
export function Barcode128({
  value,
  height = 56,
  moduleWidth = 2,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
}): React.JSX.Element {
  const { width, bars } = code128Bars(value, { height, moduleWidth });
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect width={width} height={height} fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.width} height={height} fill="#000" />
      ))}
    </svg>
  );
}

/**
 * A QR code — bigger footprint, but reads at an angle and survives a scuffed
 * corner, which is what a box label gets in a working warehouse.
 *
 * `QRCode.create` is synchronous and hands back the raw module matrix, so this
 * renders in one pass. The library's `toString` is async and would make a sheet
 * of fifty labels flash in progressively as each promise resolved.
 */
export function QrMark({
  value,
  size = 96,
}: {
  value: string;
  size?: number;
}): React.JSX.Element {
  // Medium correction: recovers ~15% damage, which covers the scuffs and tape a
  // carton label picks up, without inflating the module count the way High does.
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const data = qr.modules.data;
  // 4 modules of quiet zone either side — required by the QR spec; without it
  // scanners cannot locate the symbol against a busy label.
  const quiet = 4;
  const total = count + quiet * 2;

  const cells: React.JSX.Element[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (data[row * count + col]) {
        cells.push(
          <rect
            key={`${row}-${col}`}
            x={col + quiet}
            y={row + quiet}
            width={1}
            height={1}
          />,
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code ${value}`}
    >
      <rect width={total} height={total} fill="#fff" />
      <g fill="#000">{cells}</g>
    </svg>
  );
}
