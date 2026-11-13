import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import {
  detectLanIps,
  listenWithPortFallback,
  type NetworkInterfaceLike,
} from './lanNetwork';

describe('Server Utils: LAN Network Detection & Port Fallback', () => {
  it('filters virtual interfaces (WSL, Docker, VirtualBox, vEthernet, VMware) and prioritizes 192.168. then 10.', () => {
    const mockInterfaces: Record<string, NetworkInterfaceLike[]> = {
      docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }],
      vboxnet0: [{ address: '192.168.56.1', family: 'IPv4', internal: false }],
      'vEthernet (WSL)': [
        { address: '172.28.16.1', family: 'IPv4', internal: false },
      ],
      'VMware Network Adapter VMnet1': [
        { address: '192.168.180.1', family: 'IPv4', internal: false },
      ],
      wlan0: [{ address: '192.168.43.1', family: 'IPv4', internal: false }],
      eth0: [{ address: '10.0.0.15', family: 'IPv4', internal: false }],
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    };

    const info = detectLanIps(mockInterfaces, 3001);

    assert.equal(info.primaryIp, '192.168.43.1');
    assert.equal(info.primaryLanIp, '192.168.43.1');
    assert.equal(info.port, 3001);
    assert.equal(info.lanUrl, 'http://192.168.43.1:3001');
    assert.deepEqual(info.allLanIps, ['192.168.43.1', '10.0.0.15']);
    assert.equal(info.allLanIps.includes('172.17.0.1'), false);
    assert.equal(info.allLanIps.includes('192.168.56.1'), false);
    assert.equal(info.allLanIps.includes('172.28.16.1'), false);
    assert.equal(info.allLanIps.includes('192.168.180.1'), false);
  });

  it('falls back to 127.0.0.1 when no non-virtual external IPv4 interface exists', () => {
    const mockInterfaces: Record<string, NetworkInterfaceLike[]> = {
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }],
    };

    const info = detectLanIps(mockInterfaces, 3000);
    assert.equal(info.primaryIp, '127.0.0.1');
    assert.equal(info.lanUrl, 'http://127.0.0.1:3000');
  });

  it('automatically falls back to the next free port on EADDRINUSE', async () => {
    const blocker = http.createServer((_req, res) => res.end('busy'));
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));

    const addr = blocker.address();
    assert.ok(addr && typeof addr === 'object');
    const busyPort = addr.port;

    const appServer = http.createServer((_req, res) => res.end('ok'));
    try {
      const boundPort = await listenWithPortFallback(appServer, busyPort, '127.0.0.1', 5);
      assert.ok(boundPort > busyPort, 'Fallback port must be greater than occupied port');
    } finally {
      await new Promise<void>((resolve) => appServer.close(() => resolve()));
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('resolves adjacent dist/ directory for standalone portable 3T binaries and builds valid compilation plans', async () => {
    const { resolvePortableDistDir } = await import('./lanNetwork');
    const { resolvePortableBuildPlan } = await import('../../scripts/build-portable');

    const resolvedExecDist = resolvePortableDistDir(
      '/workspace/app',
      '/usb-drive/release/RuangLABmu-Sekolah-win.exe',
      (candidate) => candidate.startsWith('/usb-drive/release/dist')
    );
    assert.equal(resolvedExecDist, '/usb-drive/release/dist');

    const winPlan = resolvePortableBuildPlan({
      rootDir: '/workspace/app',
      targetPlatform: 'win',
      dryRun: true,
    });
    assert.equal(winPlan.binaryName, 'RuangLABmu-Sekolah-win.exe');
    assert.ok(winPlan.bunCompileArgs.includes('--compile'));
    assert.ok(winPlan.bunCompileArgs.includes('--target=bun-windows-x64'));
  });
});

