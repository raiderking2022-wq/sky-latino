'use strict';
const esbuild = require('esbuild');
const path = require('node:path');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../src/index.js')],
  outfile: path.join(__dirname, '../providers/sky-latino.js'),
  bundle: true,
  platform: 'neutral',
  format: 'cjs',
  target: 'es2016',
  external: ['cheerio-without-node-native'],
  legalComments: 'none'
});
console.log('Plugin compilado: providers/sky-latino.js');
