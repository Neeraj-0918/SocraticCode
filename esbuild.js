const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyStaticAssets() {
  // Copy webview assets
  const webviewSrc = path.join(__dirname, 'webview');
  const webviewDest = path.join(__dirname, 'dist', 'webview');
  if (fs.existsSync(webviewSrc)) {
    copyDirSync(webviewSrc, webviewDest);
    console.log('[build] Copied webview assets to dist/webview');
  }

  // Copy parser wasm assets if they exist
  const parsersSrc = path.join(__dirname, 'parsers');
  const parsersDest = path.join(__dirname, 'dist', 'parsers');
  if (fs.existsSync(parsersSrc)) {
    copyDirSync(parsersSrc, parsersDest);
    console.log('[build] Copied parser WASM assets to dist/parsers');
  }
}

async function build() {
  const context = await esbuild.context({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: './dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    plugins: [
      {
        name: 'copy-assets',
        setup(build) {
          build.onEnd(() => {
            copyStaticAssets();
          });
        },
      },
    ],
  });

  if (isWatch) {
    console.log('[build] Watching for changes...');
    await context.watch();
  } else {
    await context.rebuild();
    await context.dispose();
    console.log('[build] Build completed successfully.');
  }
}

build().catch((err) => {
  console.error('[build] Failed:', err);
  process.exit(1);
});
