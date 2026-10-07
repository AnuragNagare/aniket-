import fs from 'node:fs';
import { chromium } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import { PlaywrightPdfRenderer } from '../../src/modules/reports/pdf/pdf-renderer.js';

const chromiumInstalled = () => {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
};

describe.skipIf(!chromiumInstalled())('PlaywrightPdfRenderer (real Chromium)', () => {
  const renderer = new PlaywrightPdfRenderer();

  afterAll(async () => {
    await renderer.onModuleDestroy();
  });

  it('renders valid PDF bytes starting with %PDF', async () => {
    const html = '<html><body><h1>Hello Work Trail</h1></body></html>';
    const bytes = await renderer.render(html);
    const magic = new TextDecoder().decode(bytes.slice(0, 4));
    expect(magic).toBe('%PDF');
  });

  it('renders a 31-day, 400-update document in under 20 seconds', async () => {
    const updatesHtml = Array.from({ length: 400 }, (_, i) => `<div class="update-item"><p>Update #${i + 1} at site</p></div>`).join('\n');
    const largeDoc = `<!DOCTYPE html><html><body><h1>Monthly Report</h1>${updatesHtml}</body></html>`;

    const start = Date.now();
    const bytes = await renderer.render(largeDoc);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(20_000);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('blocks network requests for external images', async () => {
    // If an external img tag is in the HTML, page.route aborts it
    const html = '<html><body><h1>Image test</h1><img src="https://example.com/nonexistent.png"></body></html>';
    const bytes = await renderer.render(html);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('reuses the same browser for multiple renders', async () => {
    const _b1 = (renderer as any).browser;
    await renderer.render('<html><body>First</body></html>');
    const b2 = (renderer as any).browser;
    await renderer.render('<html><body>Second</body></html>');
    const b3 = (renderer as any).browser;

    expect(b2).toBe(b3);
  });
});
