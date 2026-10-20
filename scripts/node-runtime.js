'use strict';
const Module = require('node:module');
const original = Module._load;
Module._load = function (id, parent, main) {
  return original.call(this, id === 'cheerio-without-node-native' ? 'cheerio' : id, parent, main);
};
