const { promisify } = require('util');
const path = require('path');
// const writeFile = promisify(require('fs').writeFile);
const rimraf = promisify(require('rimraf'));
// const package = require('./package.json');

// function init() {
//   package['bin'] = {};
//   return writeFile(path.join(__dirname, 'package.json'), JSON.stringify(package, null, 2));
// }

function cleanup() {
  return rimraf(path.join(__dirname, 'bin2', '*'));
}

// init()
//   .then(cleanup);

cleanup();
