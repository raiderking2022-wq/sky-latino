'use strict';
// Decode only literal strings and the dictionary substitution used by a common
// player packer. No eval, Function, vm, DOM script execution or remote modules.
function literal(input) {
  if (!input || input.length > 500000 || !/^['"]/.test(input) ||
      input[input.length - 1] !== input[0]) throw new Error('invalid_literal');
  let output = '';
  const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
  for (let i = 1; i < input.length - 1; i++) {
    if (input[i] !== '\\') { output += input[i]; continue; }
    const next = input[++i];
    if (next === '\n') continue;
    if (next === 'x' || next === 'u') {
      const size = next === 'x' ? 2 : 4;
      const digits = input.slice(i + 1, i + 1 + size);
      if (!new RegExp('^[a-fA-F0-9]{' + size + '}$').test(digits)) throw new Error('invalid_escape');
      output += String.fromCharCode(parseInt(digits, 16));
      i += size;
    } else if (Object.prototype.hasOwnProperty.call(escapes, next)) output += escapes[next];
    else if (next === '\\' || next === "'" || next === '"' || next === '/') output += next;
    else throw new Error('unsupported_escape');
  }
  return output;
}

function unpack(input) {
  if (!input || input.length > 2000000) return [];
  const quoted = "('(?:\\\\.|[^'\\\\])*'|\"(?:\\\\.|[^\"\\\\])*\")";
  const expression = new RegExp('\\}\\(\\s*' + quoted + '\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*' +
    quoted + '\\.split\\(\\s*[\\\'"]\\|[\\\'"]\\s*\\)', 'g');
  const outputs = [];
  let match;
  while ((match = expression.exec(input)) && outputs.length < 3) {
    const radix = Number(match[2]);
    const count = Number(match[3]);
    if (radix < 2 || radix > 36 || count > 5000) continue;
    try {
      const payload = literal(match[1]);
      const dictionary = literal(match[4]).split('|');
      if (dictionary.length > 5000) continue;
      const expanded = payload.replace(/\b[0-9a-z]+\b/g, function (token) {
        const index = parseInt(token, radix);
        return Number.isFinite(index) && index < count && index.toString(radix) === token && dictionary[index]
          ? dictionary[index] : token;
      });
      if (expanded.length < 1000000) outputs.push(expanded);
    } catch (_) { /* Unsupported variants are inert and remain unresolved. */ }
  }
  return outputs;
}

module.exports = { literal, unpack };
