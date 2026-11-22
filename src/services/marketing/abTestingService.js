/**
 * A/B Testing & Variant Attribution Service
 * Deterministic lead variant assignment and statistically-guarded winner calculation.
 */

const { Op } = require('sequelize');
const OutreachLog = require('../../models/OutreachLog');
const OutreachTemplate = require('../../models/OutreachTemplate');

class AbTestingService {
  /**
   * Deterministically assigns 'A' or 'B' variant to a lead based on stable leadId hash.
   * Guarantees identical variant across Day 1, Day 4, and Day 7 follow-ups.
   * @param {number|string} leadId
   * @returns {'A'|'B'}
   */
  getLeadVariant(leadId) {
    if (!leadId) return 'A';
    const num = Math.abs(parseInt(leadId, 10)) || 0;
    return num % 2 === 0 ? 'A' : 'B';
  }

  getDeterministicVariant(leadId) {
    return this.getLeadVariant(leadId);
  }

  /**
   * Calculates reply rates per variant (A vs B) across outreach logs.
   * Strictly enforces minimum sample size (>= 25 sends per variant) before declaring a winner.
   * @param {string} userId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async getVariantPerformance(userId, options = {}) {
    const where = { userId };
    if (options.campaignId) where.campaignId = options.campaignId;
    if (options.channel) where.channel = options.channel;

    const logs = await OutreachLog.findAll({
      where,
      attributes: ['id', 'templateId', 'variant', 'outcome', 'channel', 'step'],
      raw: true
    });

    const stats = {
      A: { sends: 0, replies: 0, replyRate: 0 },
      B: { sends: 0, replies: 0, replyRate: 0 }
    };

    logs.forEach((log) => {
      const v = log.variant === 'B' ? 'B' : 'A';
      if (['sent', 'delivered', 'read', 'replied'].includes(log.outcome)) {
        stats[v].sends++;
      }
      if (log.outcome === 'replied') {
        stats[v].replies++;
      }
    });

    stats.A.replyRate = stats.A.sends > 0 ? parseFloat(((stats.A.replies / stats.A.sends) * 100).toFixed(1)) : 0;
    stats.B.replyRate = stats.B.sends > 0 ? parseFloat(((stats.B.replies / stats.B.sends) * 100).toFixed(1)) : 0;

    // Rule 4: Do not display a winner until each variant has at least 25 sends
    const hasSufficientData = stats.A.sends >= 25 && stats.B.sends >= 25;
    let winner = null;
    let winnerNote = null;

    if (hasSufficientData) {
      if (stats.A.replyRate > stats.B.replyRate) {
        winner = 'A';
        winnerNote = `Variant A is winning with ${stats.A.replyRate}% reply rate vs Variant B's ${stats.B.replyRate}%`;
      } else if (stats.B.replyRate > stats.A.replyRate) {
        winner = 'B';
        winnerNote = `Variant B is winning with ${stats.B.replyRate}% reply rate vs Variant A's ${stats.A.replyRate}%`;
      } else {
        winner = 'tie';
        winnerNote = `Both variants are tied at ${stats.A.replyRate}% reply rate`;
      }
    } else {
      winnerNote = `Collecting data: need at least 25 sends per variant (Current: A=${stats.A.sends}, B=${stats.B.sends})`;
    }

    return {
      variants: stats,
      variantA: stats.A,
      variantB: stats.B,
      hasSufficientData,
      hasWinner: Boolean(hasSufficientData && winner && winner !== 'tie'),
      winner,
      winnerNote,
      notice: winnerNote,
      minSendsRequired: 25
    };
  }

  async getABTestMetrics(userId, options = {}) {
    return this.getVariantPerformance(userId, options);
  }
}

module.exports = new AbTestingService();
