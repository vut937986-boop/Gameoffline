const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const webRoot = path.join(projectRoot, 'www');
const entries = ['index.html', 'manifest.webmanifest', 'icon.svg', 'sw.js', 'css', 'js', 'assets', 'images'];

fs.mkdirSync(webRoot, { recursive: true });

for (const entry of entries) {
  const source = path.join(projectRoot, entry);

  if (!fs.existsSync(source)) {
    continue;
  }

  const destination = path.join(webRoot, entry);
  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    fs.cpSync(source, destination, { recursive: true, force: true });
  } else {
    fs.copyFileSync(source, destination);
  }
}

if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
  throw new Error('The web bundle is missing www/index.html.');
}

console.log('Game files copied into www/.');