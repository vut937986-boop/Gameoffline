const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(projectRoot, 'android');
const isWindows = process.platform === 'win32';
const commandSuffix = isWindows ? '.cmd' : '';

function run(command, args, cwd = projectRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    shell: isWindows
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function findDirectory(candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

const sdkRoot = findDirectory([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
]);

if (sdkRoot) {
  process.env.ANDROID_HOME = sdkRoot;
  process.env.ANDROID_SDK_ROOT = sdkRoot;
}

const jdkRoot = findDirectory([
  process.env.JAVA_HOME,
  process.env.ANDROID_STUDIO_JBR,
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
  path.join(process.env.ProgramFiles || '', 'Android', 'Android Studio', 'jbr')
]);

if (jdkRoot) {
  process.env.JAVA_HOME = jdkRoot;
  process.env.PATH = `${path.join(jdkRoot, 'bin')}${path.delimiter}${process.env.PATH || ''}`;
}

run(process.execPath, [path.join(__dirname, 'prepare-mobile.cjs')]);

const npx = `npx${commandSuffix}`;

if (!fs.existsSync(androidRoot)) {
  run(npx, ['cap', 'add', 'android']);
}

run(npx, ['cap', 'sync', 'android']);

const gradleCommand = isWindows ? 'gradlew.bat' : './gradlew';
run(gradleCommand, ['assembleDebug'], androidRoot);

const apkPath = path.join(androidRoot, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (!fs.existsSync(apkPath)) {
  throw new Error(`Build finished without producing ${apkPath}`);
}

console.log(`APK ready: ${apkPath}`);