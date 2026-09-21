import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes delimiters and neutralises formula prefixes', () => {
    const out = toCsv(
      [{ a: 'Tata, Steel', b: '=HYPERLINK()', c: 5 }],
      [
        { header: 'A', value: (r) => r.a },
        { header: 'B', value: (r) => r.b },
        { header: 'C', value: (r) => r.c },
      ],
    );
    expect(out).toBe('A,B,C\r\n"Tata, Steel",\'=HYPERLINK(),5');
  });
});
