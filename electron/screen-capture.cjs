const { randomUUID } = require('node:crypto');

function captureSize(display, maxSide = 3840) {
  const width = Math.max(1, Math.round(display.size.width * display.scaleFactor));
  const height = Math.max(1, Math.round(display.size.height * display.scaleFactor));
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// A single transient preview lease, containing no screenshot pixels.
class CaptureLease {
  constructor({ now = () => performance.now(), ttl = 120000 } = {}) { this.now = now; this.ttl = ttl; }
  issue(displayId, revision) {
    this.current = { captureId: randomUUID(), displayId, revision, issued: this.now() };
    return { captureId: this.current.captureId, displayId, capturedAt: new Date().toISOString(), expiresInMs: this.ttl };
  }
  assert(captureId, revision) {
    const receipt = this.current;
    if (!receipt || receipt.captureId !== captureId || receipt.revision !== revision || this.now() - receipt.issued >= this.ttl) {
      throw new Error('Screenshot expired or the display changed. Refresh the screenshot and review it again.');
    }
    return { displayId: receipt.displayId };
  }
  clear() { this.current = null; }
}
module.exports = { captureSize, CaptureLease };
