const axios = require('axios');
const logger = require('../config/logger');

const robotsCache = new Map(); // domain -> { rules, expiresAt }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Checks if a URL path is allowed by robots.txt for the given domain
 * @param {string} targetUrl
 * @param {string} [userAgent='*']
 * @returns {Promise<boolean>}
 */
async function isUrlAllowed(targetUrl, userAgent = '*') {
  try {
    const parsed = new URL(targetUrl);
    const domain = parsed.hostname;
    const pathname = parsed.pathname || '/';

    const now = Date.now();
    let cached = robotsCache.get(domain);

    if (!cached || cached.expiresAt < now) {
      const robotsUrl = `${parsed.protocol}//${domain}/robots.txt`;
      let rules = [];
      try {
        const response = await axios.get(robotsUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'KnotiqBot/1.0 (+https://knotiqrugs.com/bot)' },
          validateStatus: (status) => status === 200 || status === 404
        });

        if (response.status === 200 && typeof response.data === 'string') {
          rules = parseRobotsTxt(response.data);
        }
      } catch (fetchErr) {
        // If robots.txt cannot be reached, default to open according to RFC 9309
        logger.debug({ domain, err: fetchErr.message }, 'Could not fetch robots.txt, defaulting to allow');
      }

      cached = {
        rules,
        expiresAt: now + CACHE_TTL_MS
      };
      robotsCache.set(domain, cached);
    }

    // Evaluate rules
    for (const rule of cached.rules) {
      if (rule.userAgent === '*' || rule.userAgent.toLowerCase() === userAgent.toLowerCase()) {
        for (const disallowed of rule.disallowed) {
          if (disallowed === '/') return false;
          if (pathname.startsWith(disallowed)) {
            // Check if explicitly allowed
            const isExplicitlyAllowed = rule.allowed.some((a) => pathname.startsWith(a));
            if (!isExplicitlyAllowed) return false;
          }
        }
      }
    }

    return true;
  } catch (error) {
    logger.debug({ targetUrl, error: error.message }, 'Robots.txt check error');
    return true; // Default to allow on parsing error
  }
}

/**
 * Basic parser for robots.txt content
 */
function parseRobotsTxt(content) {
  const lines = content.split('\n');
  const rules = [];
  let currentRule = null;

  for (let rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const [directive, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const dirLower = directive.trim().toLowerCase();

    if (dirLower === 'user-agent') {
      currentRule = {
        userAgent: value,
        disallowed: [],
        allowed: []
      };
      rules.push(currentRule);
    } else if (currentRule) {
      if (dirLower === 'disallow' && value) {
        currentRule.disallowed.push(value);
      } else if (dirLower === 'allow' && value) {
        currentRule.allowed.push(value);
      }
    }
  }

  return rules;
}

module.exports = {
  isUrlAllowed,
  parseRobotsTxt
};
