'use strict';
// Nuvio runtimes need not expose the browser's URL constructor.
// This pure-JS parser is bundled, not required from the device.
const ParseURL = require('url-parse');
module.exports = function URLCompat(input, base) {
  return new ParseURL(input, base || undefined);
};
