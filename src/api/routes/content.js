/**
 * Content Calendar Router
 * Manages social media and content planning (manual posting),
 * "missed" post status calculation, metrics recording, and weekly consistency tracking.
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const ContentPost = require('../../models/ContentPost');
const UserSettings = require('../../models/UserSettings');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../config/logger');

const router = express.Router();

const postSchema = z.object({
  platform: z.enum(['instagram', 'linkedin', 'facebook', 'pinterest', 'youtube', 'blog', 'newsletter', 'whatsapp_status', 'other']).default('instagram'),
  scheduledAt: z.string().nullable().optional(),
  topic: z.string().min(1, 'Topic is required').max(255),
  caption: z.string().nullable().optional(),
  hashtags: z.string().nullable().optional(),
  assetLink: z.string().nullable().optional(),
  status: z.enum(['idea', 'draft', 'ready', 'scheduled', 'posted', 'skipped']).default('idea'),
  campaignId: z.number().nullable().optional()
});

const markPostedSchema = z.object({
  postedUrl: z.string().url('A valid URL is required').or(z.string().min(3)),
  postedAt: z.string().nullable().optional(),
  impressions: z.number().nullable().optional(),
  likes: z.number().nullable().optional(),
  comments: z.number().nullable().optional(),
  saves: z.number().nullable().optional(),
  clicks: z.number().nullable().optional(),
  leadsGenerated: z.number().nullable().optional()
});

/**
 * GET /api/content - List content posts with status, platform, and date filters
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const where = { userId };

    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }
    if (req.query.platform && req.query.platform !== 'all') {
      where.platform = req.query.platform;
    }
    if (req.query.campaignId) {
      where.campaignId = parseInt(req.query.campaignId, 10);
    }
    if (req.query.undated === 'true') {
      where.scheduledAt = null;
    } else if (req.query.from && req.query.to) {
      where.scheduledAt = {
        [Op.between]: [new Date(req.query.from), new Date(req.query.to)]
      };
    }

    const posts = await ContentPost.findAll({
      where,
      order: [
        ['scheduledAt', 'ASC'],
        ['createdAt', 'DESC']
      ]
    });

    const nowMs = Date.now();
    // Rule 10: Calculate "missed" status if scheduled date has passed and not posted
    const formattedPosts = posts.map((p) => {
      const pData = p.toJSON();
      const isMissed = p.status !== 'posted' && p.status !== 'skipped' && p.scheduledAt && new Date(p.scheduledAt).getTime() < nowMs;
      return {
        ...pData,
        isMissed: Boolean(isMissed)
      };
    });

    // Calculate weekly posting consistency
    const settings = await UserSettings.findOne({ where: { userId } });
    const weeklyTarget = settings?.weeklyPostTarget || 5;

    // Start of current week (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const publishedThisWeek = await ContentPost.count({
      where: {
        userId,
        status: 'posted',
        postedAt: { [Op.gte]: startOfWeek }
      }
    });

    res.json({
      success: true,
      total: formattedPosts.length,
      posts: formattedPosts,
      consistency: {
        publishedThisWeek,
        weeklyTarget,
        percentage: Math.min(100, Math.round((publishedThisWeek / weeklyTarget) * 100))
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/content - Create a new content post (supports ideas bank and quick-add Alt+P)
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const validated = postSchema.parse(req.body);

    const post = await ContentPost.create({
      userId,
      ...validated,
      scheduledAt: validated.scheduledAt ? new Date(validated.scheduledAt) : null
    });

    await AuditLog.create({
      userId,
      action: 'create_content_post',
      entity: 'ContentPost',
      entityId: String(post.id),
      details: { topic: post.topic, platform: post.platform, status: post.status }
    }).catch(() => {});

    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/content/:id - Update content post, reschedule, or duplicate
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const post = await ContentPost.findOne({ where: { id: req.params.id, userId } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Content post not found' });
    }

    const updates = { ...req.body };
    if (updates.scheduledAt !== undefined) {
      updates.scheduledAt = updates.scheduledAt ? new Date(updates.scheduledAt) : null;
    }

    await post.update(updates);
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/content/:id/mark-posted - Dialog to mark as published with URL and optional metrics
 */
router.post('/:id/mark-posted', async (req, res, next) => {
  try {
    const userId = req.userId;
    const post = await ContentPost.findOne({ where: { id: req.params.id, userId } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Content post not found' });
    }

    const validated = markPostedSchema.parse(req.body);

    await post.update({
      status: 'posted',
      postedUrl: validated.postedUrl,
      postedAt: validated.postedAt ? new Date(validated.postedAt) : new Date(),
      impressions: validated.impressions ?? post.impressions,
      likes: validated.likes ?? post.likes,
      comments: validated.comments ?? post.comments,
      saves: validated.saves ?? post.saves,
      clicks: validated.clicks ?? post.clicks,
      leadsGenerated: validated.leadsGenerated ?? post.leadsGenerated
    });

    await AuditLog.create({
      userId,
      action: 'mark_post_published',
      entity: 'ContentPost',
      entityId: String(post.id),
      details: { postedUrl: post.postedUrl, postedAt: post.postedAt }
    }).catch(() => {});

    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/content/:id - Delete post
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const post = await ContentPost.findOne({ where: { id: req.params.id, userId } });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Content post not found' });
    }

    await post.destroy();
    res.json({ success: true, message: 'Content post deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
