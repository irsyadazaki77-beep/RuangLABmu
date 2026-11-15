import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildContentSecurityPolicyDirectives,
  buildFrameAncestorsList,
  isCrossOriginIframeRequest,
  resolveViteAllowedHosts,
  shouldRelaxHeadersForEmbeddedPreview,
} from './securityHeaders';

describe('server security header policy', () => {
  it('includes self, AI Studio ancestors, and custom ALLOWED_FRAME_ANCESTORS by default', () => {
    const list = buildFrameAncestorsList({
      isProduction: true,
      allowedFrameAncestorsEnv: 'https://lms.sekolah.sch.id, https://portal.kemdikbud.go.id',
    });

    assert.ok(list.includes("'self'"));
    assert.ok(list.includes('https://aistudio.google.com'));
    assert.ok(list.includes('https://*.usercontent.goog'));
    assert.ok(list.includes('https://lms.sekolah.sch.id'));
    assert.ok(list.includes('https://portal.kemdikbud.go.id'));
    assert.ok(!list.includes('http://localhost:*'));
  });

  it('adds localhost frame-ancestors in non-production and enforces strict self-only when requested', () => {
    const devList = buildFrameAncestorsList({ isProduction: false });
    assert.ok(devList.includes('http://localhost:*'));
    assert.ok(devList.includes('http://127.0.0.1:*'));

    const strictList = buildFrameAncestorsList({
      isProduction: false,
      strictFrameguard: true,
    });
    assert.deepEqual(strictList, ["'self'"]);
  });

  it('never relaxes X-Frame-Options or COEP/COOP in standard production even when client headers are spoofed', () => {
    assert.equal(isCrossOriginIframeRequest({ 'sec-fetch-dest': 'document' }), false);
    assert.equal(
      isCrossOriginIframeRequest({
        'sec-fetch-dest': 'iframe',
        'sec-fetch-site': 'same-origin',
      }),
      false
    );
    assert.equal(
      isCrossOriginIframeRequest({
        'sec-fetch-dest': 'iframe',
        'sec-fetch-site': 'cross-site',
      }),
      true
    );

    // Standard production (isProduction: true, allowEmbeddedPreview: false) blocks all spoofed headers
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        {
          'sec-fetch-dest': 'iframe',
          'sec-fetch-site': 'cross-site',
          origin: 'https://aistudio.google.com',
        },
        false,
        { isProduction: true, allowEmbeddedPreview: false }
      ),
      false
    );
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        { 'x-forwarded-host': 'ais-dev-example.asia-east1.run.app' },
        false,
        { isProduction: true, allowEmbeddedPreview: false }
      ),
      false
    );

    // Production with ALLOW_EMBEDDED_PREVIEW=true only relaxes for whitelisted origins inside iframe
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        {
          'sec-fetch-dest': 'iframe',
          'sec-fetch-site': 'cross-site',
          origin: 'https://aistudio.google.com',
        },
        false,
        {
          isProduction: true,
          allowEmbeddedPreview: true,
          allowedOrigins: ['https://lms.sekolah.sch.id'],
        }
      ),
      true
    );
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        {
          'sec-fetch-dest': 'iframe',
          'sec-fetch-site': 'cross-site',
          origin: 'https://evil-attacker.example.com',
        },
        false,
        {
          isProduction: true,
          allowEmbeddedPreview: true,
          allowedOrigins: ['https://lms.sekolah.sch.id'],
        }
      ),
      false
    );

    // Non-production dev mode permits valid preview iframes unless strictFrameguard is true or origin is untrusted
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' },
        false,
        { isProduction: false }
      ),
      true
    );
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        { 'x-forwarded-host': 'ais-dev-example.asia-east1.run.app' },
        false,
        { isProduction: false }
      ),
      true
    );
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' },
        true,
        { isProduction: false }
      ),
      false
    );
  });

  it('enforces strict CSP scriptSrc without unsafe-inline or unsafe-eval in production', () => {
    const prodDirectives = buildContentSecurityPolicyDirectives({
      isProduction: true,
      frameAncestors: ["'self'"],
    });
    const prodScripts = Array.from(prodDirectives.scriptSrc ?? []);
    assert.equal(prodScripts.includes("'unsafe-inline'"), false);
    assert.equal(prodScripts.includes("'unsafe-eval'"), false);
    assert.ok(prodScripts.includes("'self'"));

    const devDirectives = buildContentSecurityPolicyDirectives({
      isProduction: false,
      frameAncestors: ["'self'"],
    });
    const devScripts = Array.from(devDirectives.scriptSrc ?? []);
    assert.equal(devScripts.includes("'unsafe-eval'"), true);
  });

  it('resolves Cloud Run, APP_URL, and NG_ALLOWED_HOSTS into Vite allowedHosts cleanly', () => {
    const hosts = resolveViteAllowedHosts({
      APP_URL: 'https://ais-dev-example.asia-east1.run.app',
      NG_ALLOWED_HOSTS: 'preview.internal, *.example.edu',
    } as NodeJS.ProcessEnv);

    assert.ok(hosts.includes('.run.app'));
    assert.ok(hosts.includes('ais-dev-example.asia-east1.run.app'));
    assert.ok(hosts.includes('preview.internal'));
    assert.ok(hosts.includes('*.example.edu'));
  });
});

