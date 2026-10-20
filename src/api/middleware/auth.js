const { createClerkClient } = require('@clerk/backend');
const env = require('../../config/env');
const logger = require('../../config/logger');

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
    // Check for test / local dev bypass if enabled
    if (env.ENABLE_TEST_AUTH || env.NODE_ENV === 'test') {
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
      // If Clerk is not configured or uses placeholder keys, assign a default admin user
      if (!env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY.includes('placeholder')) {
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

    // In non-clerk test / token environment
    if (env.ENABLE_TEST_AUTH || env.NODE_ENV !== 'production') {
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
  requireAdmin
};
