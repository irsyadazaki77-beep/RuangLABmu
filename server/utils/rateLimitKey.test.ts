import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import {
  extractClientIpFromRequest,
  normalizeIpCandidate,
  parseForwardedForIps,
  rateLimitKeyGenerator,
  resolveTrustProxySetting,
} from './rateLimitKey';

function createMockRequest(options: {
  trustProxy?: boolean | number | string;
  forwarded?: string | string[];
  ip?: string;
  remoteAddress?: string;
}): Request {
  return {
    app: {
      get(key: string) {
        if (key === 'trust proxy') return options.trustProxy ?? 1;
        return undefined;
      },
    },
    headers: {
      ...(options.forwarded !== undefined ? { forwarded: options.forwarded } : {}),
    },
    ip: options.ip,
    socket: {
      remoteAddress: options.remoteAddress,
    },
  } as unknown as Request;
}

describe('rateLimitKey proxy and RFC 7239 Forwarded resolution', () => {
  it('resolves safe bounded trust proxy defaults and explicit overrides', () => {
    assert.equal(resolveTrustProxySetting({} as NodeJS.ProcessEnv), 1);
    assert.equal(resolveTrustProxySetting({ TRUST_PROXY: 'false' } as NodeJS.ProcessEnv), false);
    assert.equal(resolveTrustProxySetting({ TRUST_PROXY: '0' } as NodeJS.ProcessEnv), false);
    assert.equal(resolveTrustProxySetting({ TRUST_PROXY: 'true' } as NodeJS.ProcessEnv), 1);
    assert.equal(resolveTrustProxySetting({ TRUST_PROXY: '2' } as NodeJS.ProcessEnv), 2);
    assert.equal(
      resolveTrustProxySetting({ TRUST_PROXY: 'loopback, uniquelocal' } as NodeJS.ProcessEnv),
      'loopback, uniquelocal'
    );
  });

  it('normalizes IPv4, IPv4:port, quoted bracketed IPv6, and rejects obfuscated tokens', () => {
    assert.equal(normalizeIpCandidate('203.0.113.5'), '203.0.113.5');
    assert.equal(normalizeIpCandidate('"203.0.113.5:41234"'), '203.0.113.5');
    assert.equal(normalizeIpCandidate('"[2001:db8:cafe::17]:4711"'), '2001:db8:cafe::17');
    assert.equal(normalizeIpCandidate('[fe80::1%eth0]'), 'fe80::1');
    assert.equal(normalizeIpCandidate('unknown'), null);
    assert.equal(normalizeIpCandidate('_obfuscated'), null);
  });

  it('parses RFC 7239 Forwarded headers with multiple hops and parameters', () => {
    const ips = parseForwardedForIps(
      'for=198.51.100.10;proto=http, for="[2001:db8:abcd::42]:8080";proto=https;by=203.0.113.1'
    );
    assert.deepEqual(ips, ['198.51.100.10', '2001:db8:abcd::42']);
  });

  it('selects rightmost untrusted Forwarded hop matching trust proxy=1 and ignores Forwarded when trust proxy=false', () => {
    const spoofedAndProxied = createMockRequest({
      trustProxy: 1,
      forwarded: 'for="1.2.3.4", for="203.0.113.99";proto=https',
      ip: '10.0.0.2',
      remoteAddress: '10.0.0.2',
    });
    assert.equal(extractClientIpFromRequest(spoofedAndProxied), '203.0.113.99');

    const disabledTrust = createMockRequest({
      trustProxy: false,
      forwarded: 'for="203.0.113.99";proto=https',
      ip: '127.0.0.1',
      remoteAddress: '127.0.0.1',
    });
    assert.equal(extractClientIpFromRequest(disabledTrust), '127.0.0.1');
  });

  it('applies /56 subnet normalization for IPv6 addresses via ipKeyGenerator', () => {
    const req = createMockRequest({
      trustProxy: 1,
      forwarded: 'for="[2001:db8:1234:5678::99]:443";proto=https',
      ip: '10.0.0.1',
    });
    assert.equal(rateLimitKeyGenerator(req), '2001:db8:1234:5600::/56');
  });
});
