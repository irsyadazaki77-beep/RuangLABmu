import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface PortableBuildOptions {
  rootDir?: string;
  targetPlatform?: 'win' | 'linux' | 'mac' | 'current';
  skipClientBuild?: boolean;
  dryRun?: boolean;
}

export interface PortableBuildPlan {
  distDir: string;
  releaseDir: string;
  releaseDistDir: string;
  binaryName: string;
  binaryOutputPath: string;
  bunCompileArgs: string[];
}

export function resolvePortableBuildPlan(
  options: PortableBuildOptions = {}
): PortableBuildPlan {
  const rootDir = options.rootDir || process.cwd();
  const target = options.targetPlatform || 'current';

  let bunTargetFlag: string | null = null;
  let binaryName = 'RuangLABmu-Sekolah';

  if (target === 'win' || (target === 'current' && process.platform === 'win32')) {
    bunTargetFlag = 'bun-windows-x64';
    binaryName = 'RuangLABmu-Sekolah-win.exe';
  } else if (target === 'mac' || (target === 'current' && process.platform === 'darwin')) {
    bunTargetFlag = 'bun-darwin-x64';
    binaryName = 'RuangLABmu-Sekolah-mac';
  } else {
    bunTargetFlag = 'bun-linux-x64';
    binaryName = 'RuangLABmu-Sekolah-linux';
  }

  const distDir = path.join(rootDir, 'dist');
  const releaseDir = path.join(rootDir, 'release');
  const releaseDistDir = path.join(releaseDir, 'dist');
  const binaryOutputPath = path.join(releaseDir, binaryName);

  const bunCompileArgs = [
    'build',
    'server.ts',
    '--compile',
    '--define',
    'process.env.NODE_ENV="production"',
    '--define',
    'process.env.RUANGLAB_PORTABLE="1"',
  ];

  // Only pass explicit --target when cross-compiling for a different OS
  if (target !== 'current' && bunTargetFlag) {
    bunCompileArgs.push(`--target=${bunTargetFlag}`);
  }

  bunCompileArgs.push('--outfile', binaryOutputPath);

  return {
    distDir,
    releaseDir,
    releaseDistDir,
    binaryName,
    binaryOutputPath,
    bunCompileArgs,
  };
}

function runStep(command: string, args: string[], cwd: string): void {
  console.log(`\n[Portable 3T Builder] Menjalankan: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      `Perintah gagal dijalankan (exit code ${result.status}): ${command} ${args.join(' ')}`
    );
  }
}

export async function buildPortableRelease(
  options: PortableBuildOptions = {}
): Promise<PortableBuildPlan> {
  const rootDir = options.rootDir || process.cwd();
  const plan = resolvePortableBuildPlan(options);

  if (options.dryRun) {
    return plan;
  }

  console.log('====================================================================');
  console.log('  🎒 RUANGLABMU — PORTABLE 3T EXECUTABLE BUILDER (ZERO NODE.JS)');
  console.log('====================================================================');

  // 1. Build frontend SPA assets to dist/ using Vite
  if (!options.skipClientBuild) {
    console.log('\n[1/3] Membangun aset frontend 3D & PWA ke folder dist/ (vite build)...');
    runStep('npx', ['vite', 'build'], rootDir);
  }

  // 2. Prepare release/ directory & copy dist/ + data/ seed
  console.log('\n[2/3] Menyiapkan direktori distribusi portabel di release/...');
  await fs.promises.mkdir(plan.releaseDir, { recursive: true });
  await fs.promises.rm(plan.releaseDistDir, { recursive: true, force: true });
  await fs.promises.cp(plan.distDir, plan.releaseDistDir, { recursive: true });

  const releaseDataDir = path.join(plan.releaseDir, 'data');
  await fs.promises.mkdir(releaseDataDir, { recursive: true });
  const exampleSubFile = path.join(rootDir, 'data', 'submissions.example.json');
  if (fs.existsSync(exampleSubFile)) {
    await fs.promises.copyFile(
      exampleSubFile,
      path.join(releaseDataDir, 'submissions.json')
    );
  }

  // 3. Compile server.ts into a standalone binary using bun build --compile
  console.log(
    `\n[3/3] Mengompilasi server.ts menjadi binary mandiri (${plan.binaryName})...`
  );
  runStep('bun', plan.bunCompileArgs, rootDir);

  console.log('\n====================================================================');
  console.log('  ✅ BUILD PORTABEL 3T SELESAI!');
  console.log(`  📦 Binary Mandiri : ${plan.binaryOutputPath}`);
  console.log(`  📂 Aset Frontend  : ${plan.releaseDistDir}`);
  console.log('  💡 Guru di sekolah 3T cukup menyalin folder release/ ke flashdisk');
  console.log('     dan klik 2x binary tersebut tanpa perlu meng-install Node.js!');
  console.log('====================================================================\n');

  return plan;
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('build-portable.ts');

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith('--target='));
  const targetPlatform = targetArg
    ? (targetArg.split('=')[1] as 'win' | 'linux' | 'mac' | 'current')
    : 'current';
  const dryRun = args.includes('--dry-run');
  const skipClientBuild = args.includes('--skip-client');

  buildPortableRelease({
    targetPlatform,
    dryRun,
    skipClientBuild,
  }).catch((err) => {
    console.error('[Portable 3T Builder ERROR]:', err);
    process.exit(1);
  });
}
