const dns = require('dns').promises;
const logger = require('../config/logger');

const IPV4_REGEX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Private and reserved IP ranges (CIDR representations)
const BLOCKED_IPV4_RANGES = [
  { start: '0.0.0.0', end: '0.255.255.255' },         // Current network
  { start: '10.0.0.0', end: '10.255.255.255' },       // Private Class A
  { start: '100.64.0.0', end: '100.127.255.255' },   // Carrier-grade NAT
  { start: '127.0.0.0', end: '127.255.255.255' },     // Loopback
  { start: '169.254.0.0', end: '169.254.255.255' },   // Link-local / Cloud metadata (AWS/GCP/Azure)
  { start: '172.16.0.0', end: '172.31.255.255' },     // Private Class B
  { start: '192.0.0.0', end: '192.0.0.255' },         // IETF Protocol Assignments
  { start: '192.0.2.0', end: '192.0.2.255' },         // TEST-NET-1
  { start: '192.168.0.0', end: '192.168.255.255' },   // Private Class C
  { start: '198.18.0.0', end: '198.19.255.255' },     // Benchmarking
  { start: '198.51.100.0', end: '198.51.100.255' },   // TEST-NET-2
  { start: '203.0.113.0', end: '203.0.113.255' },     // TEST-NET-3
  { start: '224.0.0.0', end: '239.255.255.255' },     // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' }      // Reserved
];

function isIPv4(str) {
  return typeof str === 'string' && IPV4_REGEX.test(str.trim());
}

function ipToLong(ipStr) {
  return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIPv4(ipStr) {
  if (!isIPv4(ipStr)) return false;
  const targetLong = ipToLong(ipStr);

  for (const range of BLOCKED_IPV4_RANGES) {
    const startLong = ipToLong(range.start);
    const endLong = ipToLong(range.end);
    if (targetLong >= startLong && targetLong <= endLong) {
      return true;
    }
  }
  return false;
}

function isPrivateIPv6(ipStr) {
  if (!ipStr || !ipStr.includes(':')) return false;
  const lower = ipStr.toLowerCase().trim();

  // Loopback (::1)
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

  // IPv6 unique local (fc00::/7 -> starts with fc or fd)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // IPv6 link-local (fe80::/10 -> starts with fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(lower)) return true;

  // IPv4 mapped IPv6 (::ffff:127.0.0.1)
  if (lower.startsWith('::ffff:')) {
    const v4Part = lower.split('::ffff:')[1];
    return isPrivateIPv4(v4Part);
  }

  return false;
}

/**
 * Validates a target URL against SSRF attacks
 * Resolves DNS and blocks localhost, loopback, private IPs, and cloud metadata IPs
 * @param {string} targetUrl
 * @returns {Promise<{ isSafe: boolean, reason?: string, resolvedIps?: string[] }>}
 */
async function validateUrlForSsrf(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { isSafe: false, reason: 'Empty or invalid URL input' };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    return { isSafe: false, reason: 'Malformed URL structure' };
  }

  // 1. Enforce HTTP/HTTPS protocols only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isSafe: false, reason: `Blocked non-HTTP protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject obvious localhost / internal hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { isSafe: false, reason: `Blocked internal hostname: ${hostname}` };
  }

  // 3. Resolve DNS to verify all destination IPs
  try {
    // If hostname is already an IP address
    if (isIPv4(hostname)) {
      if (isPrivateIPv4(hostname)) {
        return { isSafe: false, reason: `Blocked private IPv4 destination: ${hostname}` };
      }
      return { isSafe: true, resolvedIps: [hostname] };
    }

    if (hostname.includes(':') && isPrivateIPv6(hostname)) {
      return { isSafe: false, reason: `Blocked private IPv6 destination: ${hostname}` };
    }

    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { isSafe: false, reason: 'Could not resolve hostname via DNS' };
    }

    const resolvedIps = [];
    for (const record of records) {
      resolvedIps.push(record.address);
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        return {
          isSafe: false,
          reason: `DNS resolved to blocked private IPv4 address: ${record.address}`,
          resolvedIps
        };
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        return {
          isSafe: false,
          reason: `DNS resolved to blocked private IPv6 address: ${record.address}`,
          resolvedIps
        };
      }
    }

    return { isSafe: true, resolvedIps };
  } catch (dnsErr) {
    logger.debug({ hostname, err: dnsErr.message }, 'SSRF DNS lookup failed');
    return { isSafe: false, reason: `DNS lookup failed: ${dnsErr.message}` };
  }
}

module.exports = {
  validateUrlForSsrf,
  isIPv4,
  isPrivateIPv4,
  isPrivateIPv6
};
