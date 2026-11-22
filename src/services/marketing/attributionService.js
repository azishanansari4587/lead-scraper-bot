/**
 * Marketing Attribution & Sources Analytics Service
 * Aggregates funnel metrics by source, A/B template reply rates,
 * buyer call connect rates, and exports formatted Excel reports.
 */

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const Lead = require('../../models/Lead');
const OutreachLog = require('../../models/OutreachLog');
const Call = require('../../models/Call');
const ContentPost = require('../../models/ContentPost');
const abTestingService = require('./abTestingService');
const logger = require('../../config/logger');

// Status rank for funnel evaluation
const STATUS_RANK = {
  new: 1,
  contacted: 2,
  replied: 3,
  sample_sent: 4,
  quotation: 5,
  negotiation: 5,
  won: 6,
  repeat_client: 6
};

class AttributionService {
  /**
   * Generates comprehensive sources, campaigns, and A/B conversion report
   * @param {string} userId
   * @param {object} [options]
   */
  async getSourcesReport(userId, options = {}) {
    const where = { userId };
    if (options.startDate && options.endDate) {
      where.createdAt = {
        [Op.between]: [new Date(options.startDate), new Date(options.endDate)]
      };
    }

    const [leads, calls, contentPosts, abStats] = await Promise.all([
      Lead.findAll({
        where,
        attributes: ['id', 'source', 'buyerType', 'status', 'dealValue', 'dealCurrency', 'city', 'country', 'createdAt'],
        raw: true
      }),
      Call.findAll({
        where: { userId },
        attributes: ['id', 'leadId', 'outcome', 'durationSec', 'calledAt'],
        raw: true
      }),
      ContentPost.findAll({
        where: { userId, status: 'posted' },
        attributes: ['id', 'topic', 'platform', 'postedAt', 'impressions', 'clicks', 'leadsGenerated', 'likes', 'postedUrl'],
        order: [['leadsGenerated', 'DESC'], ['clicks', 'DESC']],
        limit: 10,
        raw: true
      }),
      abTestingService.getVariantPerformance(userId, options)
    ]);

    // 1. Group leads by source
    const sourceMap = new Map();
    leads.forEach((l) => {
      const src = l.source || 'unspecified';
      if (!sourceMap.has(src)) {
        sourceMap.set(src, {
          source: src,
          total: 0,
          contacted: 0,
          replied: 0,
          sampleSent: 0,
          quotation: 0,
          won: 0,
          wonRevenue: 0,
          wonWithoutValueCount: 0
        });
      }

      const item = sourceMap.get(src);
      item.total++;

      const rank = STATUS_RANK[l.status] || 0;
      if (rank >= 2) item.contacted++;
      if (rank >= 3) item.replied++;
      if (rank >= 4) item.sampleSent++;
      if (rank >= 5) item.quotation++;
      if (rank >= 6) {
        item.won++;
        if (l.dealValue !== null && l.dealValue !== undefined) {
          item.wonRevenue += parseFloat(l.dealValue) || 0;
        } else {
          item.wonWithoutValueCount++;
        }
      }
    });

    const sourcesList = Array.from(sourceMap.values()).map((s) => ({
      ...s,
      conversionRate: s.total > 0 ? parseFloat(((s.won / s.total) * 100).toFixed(1)) : 0,
      replyRate: s.total > 0 ? parseFloat(((s.replied / s.total) * 100).toFixed(1)) : 0,
      isLowSample: s.total < 5,
      sampleNote: s.total < 5 ? `Small sample size (N=${s.total}); metrics directional only` : null
    }));

    // Sort by won deals then total leads
    sourcesList.sort((a, b) => b.won - a.won || b.total - a.total);

    // 2. Call connect rate per buyer type
    const leadBuyerMap = new Map(leads.map((l) => [l.id, l.buyerType || 'unclassified']));
    const buyerCallsMap = new Map();

    calls.forEach((c) => {
      const bType = leadBuyerMap.get(c.leadId) || 'unclassified';
      if (!buyerCallsMap.has(bType)) {
        buyerCallsMap.set(bType, { buyerType: bType, totalCalls: 0, connectedCalls: 0 });
      }
      const item = buyerCallsMap.get(bType);
      item.totalCalls++;
      if (['connected', 'interested', 'callback_requested'].includes(c.outcome)) {
        item.connectedCalls++;
      }
    });

    const buyerCallsList = Array.from(buyerCallsMap.values()).map((b) => ({
      ...b,
      connectRate: b.totalCalls > 0 ? parseFloat(((b.connectedCalls / b.totalCalls) * 100).toFixed(1)) : 0,
      isLowSample: b.totalCalls < 5
    }));
    buyerCallsList.sort((a, b) => b.connectRate - a.connectRate);

    return {
      sources: sourcesList,
      abPerformance: abStats,
      abTesting: abStats,
      buyerCalls: buyerCallsList,
      callConnectRates: buyerCallsList,
      topPosts: contentPosts,
      totalLeads: leads.length,
      totalCalls: calls.length
    };
  }

  /**
   * Generates formatted Excel workbook with formula-injection guard
   */
  async exportSourcesExcel(userId, options = {}) {
    const data = await this.getSourcesReport(userId, options);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Knotiq Rugs BMS';
    workbook.created = new Date();

    const escapeFormula = (val) => {
      if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) {
        return `'${val}`;
      }
      return val;
    };

    // Sheet 1: Sources & Funnel Conversion
    const s1 = workbook.addWorksheet('Sources Conversion');
    s1.columns = [
      { header: 'Lead Source', key: 'source', width: 25 },
      { header: 'Total Leads', key: 'total', width: 14 },
      { header: 'Contacted', key: 'contacted', width: 14 },
      { header: 'Replied', key: 'replied', width: 14 },
      { header: 'Reply Rate (%)', key: 'replyRate', width: 16 },
      { header: 'Deals Won', key: 'won', width: 14 },
      { header: 'Win Rate (%)', key: 'conversionRate', width: 16 },
      { header: 'Won Revenue (AED)', key: 'wonRevenue', width: 20 },
      { header: 'Won Without Value (Count)', key: 'wonWithoutValueCount', width: 28 },
      { header: 'Sample Size Note', key: 'sampleNote', width: 40 }
    ];

    s1.getRow(1).font = { bold: true };
    data.sources.forEach((s) => {
      s1.addRow({
        source: escapeFormula(s.source),
        total: s.total,
        contacted: s.contacted,
        replied: s.replied,
        replyRate: `${s.replyRate}% (${s.replied}/${s.total})`,
        won: s.won,
        conversionRate: `${s.conversionRate}% (${s.won}/${s.total})`,
        wonRevenue: s.wonRevenue,
        wonWithoutValueCount: s.wonWithoutValueCount,
        sampleNote: s.sampleNote || ''
      });
    });

    // Sheet 2: A/B Template Testing
    const s2 = workbook.addWorksheet('A-B Template Reply Rates');
    s2.columns = [
      { header: 'Variant', key: 'variant', width: 15 },
      { header: 'Sends', key: 'sends', width: 14 },
      { header: 'Replies', key: 'replies', width: 14 },
      { header: 'Reply Rate (%)', key: 'replyRate', width: 16 },
      { header: 'Winner Evaluation', key: 'status', width: 45 }
    ];
    s2.getRow(1).font = { bold: true };
    s2.addRow({
      variant: 'Variant A',
      sends: data.abPerformance.variants.A.sends,
      replies: data.abPerformance.variants.A.replies,
      replyRate: `${data.abPerformance.variants.A.replyRate}%`,
      status: data.abPerformance.winner === 'A' ? 'Winner (>=25 sends)' : data.abPerformance.winnerNote
    });
    s2.addRow({
      variant: 'Variant B',
      sends: data.abPerformance.variants.B.sends,
      replies: data.abPerformance.variants.B.replies,
      replyRate: `${data.abPerformance.variants.B.replyRate}%`,
      status: data.abPerformance.winner === 'B' ? 'Winner (>=25 sends)' : data.abPerformance.winnerNote
    });

    // Sheet 3: Calls by Buyer Type
    const s3 = workbook.addWorksheet('Calls by Buyer Type');
    s3.columns = [
      { header: 'Buyer Type', key: 'buyerType', width: 25 },
      { header: 'Total Calls', key: 'totalCalls', width: 14 },
      { header: 'Connected Calls', key: 'connectedCalls', width: 16 },
      { header: 'Connect Rate (%)', key: 'connectRate', width: 18 }
    ];
    s3.getRow(1).font = { bold: true };
    data.buyerCalls.forEach((b) => {
      s3.addRow({
        buyerType: escapeFormula(b.buyerType),
        totalCalls: b.totalCalls,
        connectedCalls: b.connectedCalls,
        connectRate: `${b.connectRate}% (${b.connectedCalls}/${b.totalCalls})`
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

module.exports = new AttributionService();
