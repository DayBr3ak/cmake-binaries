const { spawn } = require('child_process');
const exePaths = require('../index.js');

module.exports = function(procName) {
  const args = process.argv.slice(2);
  return spawn(exePaths[procName](), args, { stdio: [0, 1, 2]});
};
