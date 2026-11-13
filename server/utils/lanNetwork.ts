import os from 'os';
import type http from 'http';

export interface NetworkInterfaceLike {
  family: string | number;
  internal: boolean;
  address: string;
}

export interface LanNetworkInfo {
  primaryIp: string;
  primaryLanIp: string;
  localIps: string[];
  allLanIps: string[];
  port: number;
  lanUrl: string;
  isLocalHotspotReady: boolean;
  tip3T: string;
}

const VIRTUAL_INTERFACE_PATTERN = /wsl|docker|vbox|vethernet|vmware|virtual/i;

function getIpPriority(ip: string): number {
  if (ip.startsWith('192.168.')) return 100;
  if (ip.startsWith('10.')) return 90;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 50;
  return 10;
}

/**
 * Detects local LAN IPv4 addresses while filtering out virtual adapters
 * (WSL, Docker, VirtualBox, vEthernet, VMware) and prioritizes hotspot subnets.
 */
export function detectLanIps(
  interfaces: Record<string, NetworkInterfaceLike[] | undefined> = os.networkInterfaces(),
  port: number = Number(process.env.PORT) || 3000
): LanNetworkInfo {
  const candidates: string[] = [];

  for (const [ifaceName, ifaceList] of Object.entries(interfaces)) {
    if (!ifaceList || VIRTUAL_INTERFACE_PATTERN.test(ifaceName)) {
      continue;
    }
    for (const iface of ifaceList) {
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        // Exclude virtual host-only 192.168.56.x or docker default 172.17.x.x
        if (
          iface.address.startsWith('192.168.56.') ||
          iface.address.startsWith('172.17.')
        ) {
          continue;
        }
        candidates.push(iface.address);
      }
    }
  }

  const uniqueIps = Array.from(new Set(candidates));
  uniqueIps.sort((a, b) => getIpPriority(b) - getIpPriority(a));

  const primaryLanIp = uniqueIps[0] || '127.0.0.1';
  const allLanIps = uniqueIps.length > 0 ? uniqueIps : ['127.0.0.1'];

  return {
    primaryIp: primaryLanIp,
    primaryLanIp,
    localIps: allLanIps,
    allLanIps,
    port,
    lanUrl: `http://${primaryLanIp}:${port}`,
    isLocalHotspotReady: true,
    tip3T:
      'Tips Daerah 3T: Nyalakan Hotspot Wi-Fi di laptop Guru (tanpa perlu paket data internet), lalu minta siswa membuka alamat IP lokal ini untuk praktikum bersama tanpa kuota!',
  };
}

/**
 * Starts an HTTP server on preferredPort and automatically falls back to
 * consecutive ports (3001, 3002, ...) if EADDRINUSE occurs.
 */
export async function listenWithPortFallback(
  server: http.Server,
  preferredPort: number,
  host = '0.0.0.0',
  maxAttempts = 10
): Promise<number> {
  for (let offset = 0; offset <= maxAttempts; offset += 1) {
    const candidatePort = preferredPort + offset;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(candidatePort, host);
      });

      if (offset > 0) {
        console.warn(
          `[RuangLABmu] Port ${preferredPort} sedang dipakai aplikasi lain. Server otomatis berpindah ke port ${candidatePort}.`
        );
      }
      return candidatePort;
    } catch (err) {
      const errnoErr = err as NodeJS.ErrnoException;
      if (errnoErr.code === 'EADDRINUSE' && offset < maxAttempts) {
        console.warn(
          `[RuangLABmu] Port ${candidatePort} sudah digunakan (EADDRINUSE). Mencoba port ${candidatePort + 1}...`
        );
        continue;
      }

      if (errnoErr.code === 'EADDRINUSE') {
        throw new Error(
          `Semua port ${preferredPort}–${candidatePort} sedang digunakan aplikasi lain. Tutup aplikasi yang memakai port tersebut atau atur variabel PORT.`
        );
      }
      throw err;
    }
  }

  throw new Error(
    `Gagal menyalakan server RuangLABmu pada rentang port ${preferredPort}–${preferredPort + maxAttempts}.`
  );
}
