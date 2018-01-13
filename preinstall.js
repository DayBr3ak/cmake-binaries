const { promisify } = require('util');
const zlib = require('zlib');
const tar = require('tar');
const Gauge = require('gauge');
const path = require('path');
const http = require('https');

const writeFile = promisify(require('fs').writeFile);
const link = promisify(require('fs').link);
const rimraf = promisify(require('rimraf'));
const mkdirp = promisify(require('mkdirp'));
const decompress = require('decompress');

const package = require('./package.json');
const VERSION_BASE = package['cmake_version_base'];
const VERSION_REV = package['cmake_version_rev'];
const VERSION = `${VERSION_BASE}.${VERSION_REV}`;

const tempPath = path.join(__dirname, 'temp');
const linkPath = path.join(__dirname, 'bin');
const outPath = path.join(__dirname, 'bin2');

const archives = [
  'win32-x86.zip',
  'win64-x64.zip',
  'Linux-x86_64.tar.gz',
  'Darwin-x86_64.tar.gz',
];

function init() {
  return Promise.resolve();
}

function archiveToUrl(arch) {
  return `https://cmake.org/files/v${VERSION_BASE}/cmake-${VERSION}-${arch}`;
}

let archive;
if (process.platform === 'win32') {
  if (process.arch == 'x86') {
    archive = archives[0];
  } else if (process.arch === 'x64') {
    archive = archives[1];
  } else {
    throw new Error('unsupported architecture');
  }
} else if (process.platform === 'linux') {
  archive = archives[2];
} else if (process.platform === 'darwin') {
  archive = archives[3];
} else {
  throw new Error('unsupported platform');
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      const totalSize = parseInt(res.headers['content-length'], 10);
      const gauge = new Gauge();
      let currentSize = 0;
      const buffers = [];
      res.on('data', data => {
        currentSize += data.length;
        buffers.push(data);
        const progress = currentSize / totalSize;
        gauge.show(`${(progress * 100).toFixed(0)}%`, progress);
        gauge.pulse(url);
      });

      res.on('end', () => {
        const b = Buffer.concat(buffers, totalSize);
        gauge.hide();
        resolve(b);
      });

      res.on('error', reject);
    });
  });
}

function makeEmptyFile(path) {
  return writeFile(path, '');
}

function makeLinks() {
  const exePaths = require('./index.js');
  const promises = [];
  for (const _name of Object.keys(exePaths)) {
    let name = _name;
    if (name === 'cmakeGui') name = 'cmake-gui';
    try {
      const exe = exePaths[_name]();

      if (process.platform === 'win32') {
        // npm on windows is f** stupid, you need both an exe and a file without extension for it to install.
        promises.push(makeEmptyFile(path.join(linkPath, name)));
        name = name + '.exe';
      }
      const p = link(exe, path.join(linkPath, name));
      promises.push(p);

    } catch (e) {
      if (e.message.includes('is only supported on')) {
        // create error script!

        const file = `#!/usr/bin/env node
console.error("${e.message}");
process.exit(1);
`;
        promises.push(writeFile(path.join(linkPath, name), file));
      } else {
        throw e;
      }
    }
  }

  return Promise.all(promises);
}

const isTar = archive.includes('tar.gz');
const unzip = isTar ?
  (input, output) => tar.x({ file: input, cwd: output, strip: 1 })
  :(input, output) => decompress(input, output, { strip: 1 })

const url = archiveToUrl(archive);

init()
  .then(() => mkdirp(outPath))
  .then(() => mkdirp(linkPath))
  .then(() => rimraf(path.join(outPath, '*')))
  .then(() => fetchBuffer(url))
  .then(b => writeFile(tempPath, b, 'binary'))
  .then(() => unzip(tempPath, outPath))
  .then(() => rimraf(tempPath))
  .then(makeLinks)
  .then(() => console.log('done!'))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
