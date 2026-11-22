/**
 * Unified Activity Timeline Service
 * Aggregates Calls, Outreach (Email/WhatsApp), Notes, Follow-ups, and Status transitions
 * into a single chronological feed for any lead.
 */

const Call = require('../../models/Call');
const Note = require('../../models/Note');
const FollowUp = require('../../models/FollowUp');
const OutreachLog = require('../../models/OutreachLog');
const BulkSendLog = require('../../models/BulkSendLog');
const AuditLog = require('../../models/AuditLog');

class TimelineService {
  /**
   * Returns a sorted chronological timeline for a specific lead
   * @param {string} userId
   * @param {number} leadId
   * @returns {Promise<Array>}
   */
  async getLeadTimeline(userId, leadId) {
    const [calls, notes, followUps, outreachLogs, bulkLogs] = await Promise.all([
      Call.findAll({
        where: { userId, leadId },
        order: [['calledAt', 'DESC']],
        raw: true
      }),
      Note.findAll({
        where: { userId, ownerType: 'lead', ownerId: String(leadId) },
        order: [['createdAt', 'DESC']],
        raw: true
      }),
      FollowUp.findAll({
        where: { userId, leadId },
        order: [['dueAt', 'DESC']],
        raw: true
      }),
      OutreachLog.findAll({
        where: { userId, leadId },
        order: [['sentAt', 'DESC']],
        raw: true
      }),
      BulkSendLog.findAll({
        where: { leadId },
        order: [['sentAt', 'DESC']],
        raw: true
      })
    ]);

    const timeline = [];

    // 1. Calls
    calls.forEach((c) => {
      timeline.push({
        id: `call_${c.id}`,
        type: 'call',
        title: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call (${c.outcome})`,
        summary: c.summary || `Call logged by ${c.createdBy || 'founder'}`,
        timestamp: c.calledAt || c.createdAt,
        metadata: {
          durationSec: c.durationSec,
          outcome: c.outcome,
          nextAction: c.nextAction,
          nextFollowUpAt: c.nextFollowUpAt
        }
      });
    });

    // 2. Notes
    notes.forEach((n) => {
      timeline.push({
        id: `note_${n.id}`,
        type: 'note',
        title: n.title || 'Internal Note',
        summary: n.body,
        timestamp: n.createdAt,
        metadata: {
          pinned: n.pinned,
          tags: n.tags
        }
      });
    });

    // 3. Follow-ups
    followUps.forEach((f) => {
      timeline.push({
        id: `followup_${f.id}`,
        type: 'followup',
        title: `Follow-up ${f.step ? f.step.toUpperCase() : ''} (${f.status})`,
        summary: f.notes || `Scheduled ${f.channel} follow-up`,
        timestamp: f.dueAt,
        metadata: {
          dueAt: f.dueAt,
          channel: f.channel,
          status: f.status,
          step: f.step
        }
      });
    });

    // 4. Outreach Logs
    outreachLogs.forEach((o) => {
      timeline.push({
        id: `outreach_${o.id}`,
        type: o.channel === 'whatsapp' ? 'whatsapp' : 'email',
        title: `${o.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} ${o.step} (${o.outcome})`,
        summary: o.messageSent || `Message dispatched to ${o.recipient || 'lead'}`,
        timestamp: o.sentAt || o.createdAt,
        metadata: {
          channel: o.channel,
          outcome: o.outcome,
          recipient: o.recipient,
          error: o.error
        }
      });
    });

    // 5. Bulk Send Logs (if not already recorded in OutreachLog)
    bulkLogs.forEach((b) => {
      timeline.push({
        id: `bulk_${b.id}`,
        type: b.channel === 'whatsapp' ? 'whatsapp' : 'email',
        title: `Campaign ${b.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} (${b.status})`,
        summary: b.error ? `Failed: ${b.error}` : `Delivered via campaign #${b.jobId}`,
        timestamp: b.sentAt || b.createdAt,
        metadata: {
          jobId: b.jobId,
          status: b.status,
          channel: b.channel
        }
      });
    });

    // Sort all events by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return timeline;
  }
}

module.exports = new TimelineService();
