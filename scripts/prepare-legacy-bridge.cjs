'use strict';
// Prepare a compatible archive without touching the running installation.
// Installation is a separate, explicit step after the original process exits.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const asar = require('@electron/asar');
const { patchLegacy } = require('../compat/patch-legacy.cjs');
const root = path.resolve(__dirname, '..');
const source =
  process.argv.slice(2).find((value) => !value.startsWith('--')) ||
  path.join(process.env.LOCALAPPDATA, 'Programs/agent-toolbox/resources/app.asar');
const stage = path.join(root, 'work/legacy-bridge-stage');
const output = path.join(root, 'work/legacy-bridge/app.asar');
(async () => {
  if (fs.existsSync(stage) && !process.argv.includes('--reuse-stage'))
    throw Error('暂存目录已存在；核对后可用 --reuse-stage 重新准备。');
  const packageInfo = JSON.parse(asar.extractFile(source, 'package.json'));
  if (packageInfo.name !== 'agent-toolbox' || packageInfo.version !== '0.46.26')
    throw Error('当前兼容补丁仅验证过旧版 0.46.26。');
  const files = {};
  for (const name of ['main.js', 'ai-hub.js', 'drawing-sync.js', 'app.js'])
    files[name] = asar
      .extractFile(source, path.join('src', name === 'app.js' ? 'renderer' : 'main', name))
      .toString();
  const patched = patchLegacy(files);
  for (const [name, sourceText] of Object.entries(patched))
    if (name === 'app.js') require('esbuild').transformSync(sourceText, { loader: 'js' });
    else new vm.Script(sourceText, { filename: name });
  if (!fs.existsSync(stage)) asar.extractAll(source, stage);
  for (const [name, sourceText] of Object.entries(patched))
    fs.writeFileSync(
      path.join(stage, 'src', name === 'app.js' ? 'renderer' : 'main', name),
      sourceText,
    );
  fs.copyFileSync(
    path.join(root, 'compat/legacy-bridge.cjs'),
    path.join(stage, 'src/main/v2-bridge.js'),
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // Reproduce every original unpacked file, including native Sharp dependencies.
  const unpacked = asar
    .listPackage(source)
    .map((p) => p.replace(/^[/\\]/, ''))
    .filter((p) => {
      const stat = asar.statFile(source, p);
      return stat.unpacked && !stat.files;
    })
    .map((p) => p.replace(/\\/g, '/'));
  await asar.createPackageWithOptions(stage, output, {
    unpack: `{${unpacked.map((p) => path.join(stage, p).replace(/\\/g, '/')).join(',')}}`,
  });
  for (const name of ['main.js', 'ai-hub.js', 'drawing-sync.js', 'app.js'])
    if (
      asar
        .extractFile(output, path.join('src', name === 'app.js' ? 'renderer' : 'main', name))
        .toString() !== patched[name]
    )
      throw Error('生成档案校验失败');
  for (const p of unpacked)
    if (!asar.statFile(output, p.split('/').join(path.sep)).unpacked)
      throw Error('原生文件展开标记未保留');
  const digest = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  fs.writeFileSync(
    path.join(path.dirname(output), 'proof.json'),
    JSON.stringify(
      {
        version: packageInfo.version,
        sourceSha256: digest(source),
        outputSha256: digest(output),
        originalUnpackedFiles: unpacked.length,
        patchedFiles: Object.keys(patched),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ prepared: true, unpackedFilesPreserved: unpacked.length }));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
