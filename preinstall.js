const { promisify } = require('util');
const zlib = require('zlib');
const tar = require('tar');
const Gauge = require('gauge');
const path = require('path');
const http = require('https');

const writeFile = promisify(require('fs').writeFile);
const readFile = promisify(require('fs').readFile);
const rimraf = promisify(require('rimraf'));
const mkdirp = promisify(require('mkdirp'));
const decompress = require('decompress');

const package = require('./package.json');
const VERSION_BASE = package['cmake_version_base'];
const VERSION_REV = package['cmake_version_rev'];
const VERSION = `${VERSION_BASE}.${VERSION_REV}`;

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

const isTar = archive.includes('tar.gz');
const unzip = isTar ?
  (input, output) => tar.x({ file: input, cwd: output, strip: 1 })
  :(input, output) => decompress(input, output, { strip: 1 })

const url = archiveToUrl(archive);
const tempPath = path.join(__dirname, 'temp');
const outPath = path.join(__dirname, 'bin2');

init()
  .then(() => mkdirp(outPath))
  .then(() => rimraf(path.join(outPath, '*')))
  .then(() => fetchBuffer(url))
  .then(b => writeFile(tempPath, b, 'binary'))
  .then(() => unzip(tempPath, outPath))
  .then(() => rimraf(tempPath))
  .then(() => console.log('done'))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
