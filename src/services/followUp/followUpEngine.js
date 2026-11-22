/**
 * Follow-up Engine for Knotiq Rugs
 * Manages Day 4 (+3 days) and Day 7 (+6 days) automated follow-up scheduling
 * and cancellation upon recipient reply.
 */

const FollowUp = require('../../models/FollowUp');
const Lead = require('../../models/Lead');
const OutreachLog = require('../../models/OutreachLog');
const logger = require('../../config/logger');

class FollowUpEngine {
  /**
   * Schedules initial Day 4 and Day 7 follow-ups when first outreach is recorded
   * @param {string} userId
   * @param {number} leadId
   * @param {string} initialChannel ('email' | 'whatsapp')
   */
  async scheduleInitialFollowUps(userId, leadId, initialChannel = 'call') {
    try {
      const existing = await FollowUp.count({
        where: { userId, leadId, status: 'pending' }
      });

      // Only schedule if no pending follow-ups exist
      if (existing > 0) {
        return;
      }

      const now = new Date();

      // Day 4: +3 days from now, set to 10:00 AM UTC
      const day4 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      day4.setUTCHours(6, 0, 0, 0); // 10:00 AM GST (UTC+4) is 06:00 UTC

      // Day 7: +6 days from now, set to 10:00 AM UTC
      const day7 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
      day7.setUTCHours(6, 0, 0, 0);

      const channel = initialChannel === 'whatsapp' ? 'whatsapp' : (initialChannel === 'email' ? 'email' : 'call');

      await FollowUp.bulkCreate([
        {
          userId,
          leadId,
          dueAt: day4,
          channel,
          step: 'day4',
          status: 'pending',
          notes: 'Automated Day 4 follow-up: Check digital catalog & offer yarn swatch box.'
        },
        {
          userId,
          leadId,
          dueAt: day7,
          channel,
          step: 'day7',
          status: 'pending',
          notes: 'Automated Day 7 follow-up: Final follow-up on custom size specs and project timeline.'
        }
      ]);

      // Update lead nextFollowUpAt to the earliest pending follow-up (Day 4)
      await Lead.update(
        { nextFollowUpAt: day4 },
        { where: { id: leadId, userId } }
      );

      logger.info({ leadId, day4, day7 }, 'Scheduled Day 4 and Day 7 follow-ups');
    } catch (err) {
      logger.error({ err: err.message, leadId }, 'Failed to schedule initial follow-ups');
    }
  }

  /**
   * Action when recipient replies:
   * 1. Cancels all pending follow-ups for this lead
   * 2. Moves lead status to 'replied'
   * 3. Clears nextFollowUpAt
   * 4. Logs to OutreachLog with outcome: 'replied'
   */
  async markReplied(userId, leadId, replyNote = '') {
    const lead = await Lead.findOne({ where: { id: leadId, userId } });
    if (!lead) {
      throw new Error(`Lead #${leadId} not found`);
    }

    // Cancel all pending follow-ups
    const [cancelledCount] = await FollowUp.update(
      { status: 'cancelled', notes: replyNote ? `Cancelled: ${replyNote}` : 'Cancelled because lead replied' },
      { where: { userId, leadId, status: 'pending' } }
    );

    // Update lead status and clear next follow up
    await lead.update({
      status: 'replied',
      nextFollowUpAt: null
    });

    // Record an outreach log entry for the reply
    await OutreachLog.create({
      userId,
      leadId,
      channel: lead.whatsapp ? 'whatsapp' : 'email',
      step: 'reply_received',
      messageSent: replyNote || 'Lead replied to outreach',
      outcome: 'replied',
      recipient: lead.email || lead.phone || lead.businessName
    });

    logger.info({ leadId, cancelledCount }, 'Lead marked as replied and pending follow-ups cancelled');

    return {
      success: true,
      leadId,
      cancelledCount,
      newStatus: 'replied'
    };
  }
}

module.exports = new FollowUpEngine();
