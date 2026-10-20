'use strict';
const dns = require('node:dns').promises;
const { isIPv4 } = require('node:net');

// IPv4-only transport: reject private, link-local, documentation, multicast and
// reserved destinations. IPv6 is not used, including IPv4-mapped IPv6 addresses.
function isPublicIPv4(address) {
  if (!isIPv4(address)) return false;
  const p = address.split('.').map(Number);
  if ([0, 10, 127].includes(p[0]) || p[0] >= 224) return false;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false;
  if (p[0] === 169 && p[1] === 254) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  if (p[0] === 192 && (p[1] === 168 || p[1] === 0 ||
      p[1] === 88 && p[2] === 99)) return false;
  if (p[0] === 198 && (p[1] === 18 || p[1] === 19 ||
      p[1] === 51 && p[2] === 100)) return false;
  if (p[0] === 203 && p[1] === 0 && p[2] === 113) return false;
  return true;
}

async function resolvePublicAddress(hostname, lookup) {
  if (hostname.endsWith('.')) throw new Error('unsafe_host');
  let timer;
  let addresses;
  try {
    addresses = await Promise.race([
      (lookup || dns.lookup)(hostname, { family: 4, all: true }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('dns_timeout')), 3000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
  if (!Array.isArray(addresses) || !addresses.length ||
      addresses.some(item => item.family !== 4 || !isPublicIPv4(item.address)))
    throw new Error('unsafe_address');
  return addresses[0].address;
}

module.exports = { isPublicIPv4, resolvePublicAddress };
