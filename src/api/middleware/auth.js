const { createClerkClient } = require('@clerk/backend');
const env = require('../../config/env');
const logger = require('../../config/logger');

const KNOWN_DEFAULTS = {
  CLERK_SECRET_KEY: [
    'sk_test_placeholder',
    'placeholder',
    'sk_test_placeholder_key_for_clerk_auth'
  ],
  APP_SECRET: [
    'dev-secret-string-at-least-32-chars-long-security',
    'super-secure-default-change-in-production-at-least-32-bytes',
    'your-32-character-secret-key-goes-here',
    'replace-with-a-secure-random-secret-at-least-32-chars'
  ],
  BULK_PASSWORD: [
    'knotiq2026',
    'admin',
    'password',
    'changeme'
  ],
  DOWNLOAD_SIGNING_SECRET: [
    'dev-signing-secret-random-32chars',
    'your-download-signing-secret-here',
    'sign-secret-change-this-in-production-123456'
  ]
};

/**
 * Validates that all production secrets are defined, strong, and not known defaults.
 * Fails fast with a clear error message.
 */
function validateProductionSecrets(targetEnv = env) {
  const currentEnv = targetEnv.NODE_ENV || process.env.NODE_ENV;
  if (currentEnv !== 'production') {
    return;
  }

  const checks = [
    {
      name: 'CLERK_SECRET_KEY',
      value: targetEnv.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
      defaults: KNOWN_DEFAULTS.CLERK_SECRET_KEY
    },
    {
      name: 'APP_SECRET',
      value: targetEnv.APP_SECRET || process.env.APP_SECRET,
      defaults: KNOWN_DEFAULTS.APP_SECRET,
      minLength: 32
    },
    {
      name: 'BULK_PASSWORD',
      value: targetEnv.BULK_PASSWORD || process.env.BULK_PASSWORD,
      defaults: KNOWN_DEFAULTS.BULK_PASSWORD
    },
    {
      name: 'DOWNLOAD_SIGNING_SECRET',
      value: targetEnv.DOWNLOAD_SIGNING_SECRET || process.env.DOWNLOAD_SIGNING_SECRET,
      defaults: KNOWN_DEFAULTS.DOWNLOAD_SIGNING_SECRET
    }
  ];

  for (const check of checks) {
    if (!check.value || typeof check.value !== 'string' || check.value.trim() === '') {
      throw new Error(`Production startup aborted: ${check.name} is missing. A secure value must be configured in production.`);
    }

    const val = check.value.trim().toLowerCase();
    const isKnownDefault = check.defaults.some(
      (d) => val === d.toLowerCase() || val.includes(d.toLowerCase())
    );

    if (isKnownDefault) {
      throw new Error(
        `Production startup aborted: ${check.name} is set to a known default or placeholder value ('${check.value}'). You must configure a unique, secure secret in production.`
      );
    }

    if (check.minLength && check.value.trim().length < check.minLength) {
      throw new Error(
        `Production startup aborted: ${check.name} must be at least ${check.minLength} characters long in production.`
      );
    }
  }
}

// Fail startup immediately if loaded in production with invalid secrets
if ((process.env.NODE_ENV || env.NODE_ENV) === 'production') {
  validateProductionSecrets();
}

let clerkClient = null;
if (env.CLERK_SECRET_KEY && !env.CLERK_SECRET_KEY.includes('placeholder')) {
  try {
    clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY, publishableKey: env.CLERK_PUBLISHABLE_KEY });
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Clerk client, falling back to mock auth');
  }
}

/**
 * Clerk JWT verification middleware with strict per-user scoping
 */
async function requireAuth(req, res, next) {
  try {
    const isProduction = (process.env.NODE_ENV || env.NODE_ENV) === 'production';

    // In production, ignore ENABLE_TEST_AUTH completely.
    // In dev/test, check for test bypass header.
    if (!isProduction && (env.ENABLE_TEST_AUTH || env.NODE_ENV === 'test')) {
      const testUserId = req.headers['x-test-user-id'];
      if (testUserId) {
        req.auth = {
          userId: testUserId,
          role: req.headers['x-test-role'] || 'admin'
        };
        req.userId = req.auth.userId;
        return next();
      }
    }

    // Check authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In non-production, if Clerk is not configured or uses placeholder keys, assign a default admin user
      if (!isProduction && (!env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY.includes('placeholder'))) {
        req.auth = {
          userId: 'admin_user_knotiq',
          role: 'admin'
        };
        req.userId = req.auth.userId;
        return next();
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization token is required.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (clerkClient) {
      const requestState = await clerkClient.authenticateRequest(req, {
        jwtKey: env.CLERK_JWT_KEY
      });

      if (!requestState.isSignedIn) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired authentication session.'
        });
      }

      const authData = requestState.toAuth();
      req.auth = {
        userId: authData.userId,
        sessionId: authData.sessionId,
        role: authData.orgRole === 'admin' ? 'admin' : (authData.role || 'user')
      };
      req.userId = req.auth.userId;
      return next();
    }

    // In non-clerk non-production environment
    if (!isProduction && (env.ENABLE_TEST_AUTH || env.NODE_ENV !== 'production')) {
      req.auth = {
        userId: token || 'dev_user_knotiq',
        role: 'admin'
      };
      req.userId = req.auth.userId;
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication service unavailable.'
    });
  } catch (error) {
    logger.error({ error }, 'Authentication middleware failure');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed.'
    });
  }
}

/**
 * Admin check middleware
 */
function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Administrator privileges required for this action.'
    });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  validateProductionSecrets,
  KNOWN_DEFAULTS
};
