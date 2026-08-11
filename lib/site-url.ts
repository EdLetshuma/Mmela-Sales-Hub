// The one place that decides what domain gets baked into a public form
// link, QR code, or embed snippet. Deliberately does NOT fall back to
// window.location.origin — a QR code printed on a poster or an iframe
// pasted into someone's website has to keep working even when viewed
// from a preview deployment or a different environment than production.
//
// Set NEXT_PUBLIC_SITE_URL to override (e.g. once a custom domain is
// configured in Vercel); until then this points at the stable production
// alias, never a branch/PR preview URL.
const PRODUCTION_SITE_URL = "https://mmela-sales-hub.vercel.app";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_SITE_URL;
}

export function getFormUrl(slug: string): string {
  return `${getSiteUrl()}/f/${slug}`;
}
