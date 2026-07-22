// pdf-parse's underlying pdfjs-dist expects a handful of browser Canvas
// APIs to exist even when only extracting text (no rendering). Without
// @napi-rs/canvas installed it throws a hard ReferenceError in some
// runtimes (observed on Vercel's serverless Node, though not reproducible
// locally) instead of degrading gracefully. These are harmless no-op
// stubs — we never rasterize or render anything, only extract text — and
// must be imported before pdf-parse so they exist by the time it loads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

if (typeof g.DOMMatrix === "undefined") {
  g.DOMMatrix = class DOMMatrix {};
}
if (typeof g.ImageData === "undefined") {
  g.ImageData = class ImageData {};
}
if (typeof g.Path2D === "undefined") {
  g.Path2D = class Path2D {};
}
