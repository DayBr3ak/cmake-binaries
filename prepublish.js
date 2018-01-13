const { promisify } = require('util');
const path = require('path');
const rimraf = promisify(require('rimraf'));

function cleanup() {
  return rimraf(path.join(__dirname, 'bin2', '*'))
    .then(() => rimraf(path.join(__dirname, 'bin', '*')));
}

cleanup();
