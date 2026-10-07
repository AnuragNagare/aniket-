import type { PdfRenderer } from './pdf-renderer.js';

export class FakePdfRenderer implements PdfRenderer {
  lastHtml: string | null = null;
  calls = 0;
  shouldFail = false;

  async render(html: string): Promise<Uint8Array> {
    this.calls++;
    this.lastHtml = html;
    if (this.shouldFail) {
      throw new Error('PDF rendering failed');
    }
    return new TextEncoder().encode('%PDF-1.4\n% fake pdf content\n');
  }

  reset() {
    this.lastHtml = null;
    this.calls = 0;
    this.shouldFail = false;
  }
}
