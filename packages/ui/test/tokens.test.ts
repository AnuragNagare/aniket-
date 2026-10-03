import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokens } from '../src/tokens.js';

const css = readFileSync(resolve(__dirname, '../src/theme.css'), 'utf8');

function flatten(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string'
      ? [[`${prefix}${k}`, v] as [string, string]]
      : flatten(v as Record<string, unknown>, `${prefix}${k}-`),
  );
}

describe('theme.css mirrors tokens.ts', () => {
  it.each(flatten(tokens.color))('--color-%s is %s', (name, hex) => {
    expect(css).toContain(`--color-${name}: ${hex};`);
  });

  it('declares radius and shadow tokens', () => {
    expect(css).toContain(`--radius-input: ${tokens.radius.input}px;`);
    expect(css).toContain(`--radius-card: ${tokens.radius.card}px;`);
    expect(css).toContain(`--radius-panel: ${tokens.radius.panel}px;`);
    expect(css).toContain(`--shadow-card: ${tokens.shadow.card};`);
  });
});
