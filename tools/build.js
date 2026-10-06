// Builds dist/GambelStrike2.html: one self-contained file (three.js, fonts, CSS and all game
// scripts inlined) that runs offline by double-click. Usage: npm install && npm run build
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nm = path.join(__dirname, 'node_modules');
const out = path.join(root, 'dist', 'GambelStrike2.html');
const version = require('./package.json').version;

const read = (p) => fs.readFileSync(p, 'utf8');
// keep inline code from closing its own <script>/<style> tag early
const safe = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');

function fontFaces() {
  const faces = [
    ['Chakra Petch', '@fontsource/chakra-petch/files/chakra-petch-latin-%w-normal.woff2', [400, 500, 600, 700]],
    ['Inter', '@fontsource/inter/files/inter-latin-%w-normal.woff2', [400, 500, 600, 800]],
  ];
  let css = '';
  for (const [family, pattern, weights] of faces) {
    for (const w of weights) {
      const file = path.join(nm, pattern.replace('%w', w));
      const b64 = fs.readFileSync(file).toString('base64');
      css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}\n`;
    }
  }
  return css;
}

let html = read(path.join(root, 'index.html'));

// fonts: drop the Google Fonts links, embed the woff2 files instead
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '');
html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${fontFaces()}${safe(read(path.join(root, 'css', 'style.css')))}\n</style>`);

// CDN scripts -> local copies from node_modules/three
html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/([^"]+)"><\/script>/g, (_, rel) => {
  const file = path.join(nm, 'three', rel);
  return `<script>/* three@0.147.0/${rel} */\n${safe(read(file))}\n</script>`;
});

// game scripts
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, rel) => `<script>/* ${rel} */\n${safe(read(path.join(root, rel)))}\n</script>`);

if (/src="https?:|href="https?:/.test(html)) throw new Error('build still references a remote URL');
html = html.replace('<head>', `<head>\n<!-- GambelStrike 2 v${version} — offline build ${new Date().toISOString().slice(0, 10)} -->`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`built ${path.relative(root, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);

// Windows launcher: compiled with the C# compiler bundled with .NET Framework (no extra install)
const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (process.platform === 'win32' && fs.existsSync(csc)) {
  const { execFileSync } = require('child_process');
  execFileSync(csc, [
    '/nologo', '/target:winexe', '/optimize+',
    '/out:dist\\GambelStrike2.exe',
    '/win32icon:launcher\\icon.ico',
    '/resource:dist\\GambelStrike2.html,GambelStrike2.html',
    '/reference:System.Windows.Forms.dll',
    'launcher\\Launcher.cs',
  ], { cwd: root, stdio: 'inherit' });
  console.log(`built dist\\GambelStrike2.exe (${(fs.statSync(path.join(root, 'dist', 'GambelStrike2.exe')).size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.log('skipped GambelStrike2.exe (needs Windows with .NET Framework 4.x)');
}
