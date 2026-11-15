const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');

const root = __dirname;
const output = path.join(root, 'dist');

execFileSync(process.execPath, [path.join(root, 'build-offline-assets.js')], {
  cwd: root,
  stdio: 'inherit'
});

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'offline-assets.json'), 'utf8'));
const assets = [...new Set([...manifest.assets, 'offline-assets.json'])];

fs.rmSync(output, { recursive: true, force: true });

for (const asset of assets) {
  const source = path.resolve(root, asset);
  const relative = path.relative(root, source);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe mobile asset path: ${asset}`);
  }
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Missing mobile asset: ${asset}`);
  }
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

esbuild.buildSync({
  entryPoints: [path.join(root, 'assets', 'live-notifications.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  alias: {
    'firebase/app': '@firebase/app',
    'firebase/messaging': '@firebase/messaging'
  },
  outfile: path.join(output, 'assets', 'live-notifications.bundle.js')
});

console.log(JSON.stringify({ assets: assets.length, output: path.basename(output) }));