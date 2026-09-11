/**
 * Email — an address that survives Cloudflare's edge rewriter.
 *
 * Cloudflare's "Email Address Obfuscation" rewrites any plain-text email in
 * the HTML response *after* it leaves the origin, replacing the text node with
 * `<a class="__cf_email__">[email protected]</a>` plus a decoder script. React
 * then hydrates against markup that no longer matches what it prerendered and
 * throws hydration error #418 — which is exactly what /en/about did in
 * production while `next dev` stayed clean.
 *
 * Verified against the live zone: an address wrapped in Cloudflare's
 * documented `<!--email_off-->` markers passes through untouched, so the text
 * node React expects is still there at hydration time.
 *
 * Wrap the *visible* address only. A `mailto:` href is an attribute, not a
 * text node, so rewriting it never breaks hydration — leave existing links,
 * classes and query params (`?subject=…`) exactly as they are.
 *
 * The comment markers cannot be expressed in JSX, hence
 * `dangerouslySetInnerHTML`. It is safe here because only a syntactically
 * valid address is ever interpolated; anything else renders as plain text.
 */
const ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function Email({ address, className }: { address: string; className?: string }) {
  if (!ADDRESS.test(address)) {
    return <span className={className}>{address}</span>;
  }
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: `<!--email_off-->${address}<!--email_on-->` }}
    />
  );
}

export default Email;
