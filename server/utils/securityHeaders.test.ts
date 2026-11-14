import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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

  it('relaxes X-Frame-Options and COEP only for cross-origin iframe navigations unless strictFrameguard is true', () => {
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

    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' },
        false
      ),
      true
    );
    assert.equal(
      shouldRelaxHeadersForEmbeddedPreview(
        { 'sec-fetch-dest': 'iframe', 'sec-fetch-site': 'cross-site' },
        true
      ),
      false
    );
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
