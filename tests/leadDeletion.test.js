const request = require('supertest');
const app = require('../src/api/server');
const {
  Lead,
  Campaign,
  CampaignLead,
  Call,
  FollowUp,
  OutreachLog,
  Note,
  Task,
  CalendarEvent,
  Mindmap,
  MindmapNode
} = require('../src/models');

describe('Leads Safe Deletion & Cascade Isolation', () => {
  const userIdA = 'test_del_user_a';
  const userIdB = 'test_del_user_b';

  beforeEach(async () => {
    // Clean up
    await CampaignLead.destroy({ where: { userId: [userIdA, userIdB] } });
    await Call.destroy({ where: { userId: [userIdA, userIdB] } });
    await FollowUp.destroy({ where: { userId: [userIdA, userIdB] } });
    await OutreachLog.destroy({ where: { userId: [userIdA, userIdB] } });
    await Note.destroy({ where: { userId: [userIdA, userIdB] } });
    await Task.destroy({ where: { userId: [userIdA, userIdB] } });
    await CalendarEvent.destroy({ where: { userId: [userIdA, userIdB] } });
    await Lead.destroy({ where: { userId: [userIdA, userIdB] } });
  });

  it('DELETE /api/leads/:id successfully deletes a lead with linked child records without FK error', async () => {
    // 1. Create a lead
    const lead = await Lead.create({
      userId: userIdA,
      businessName: 'Del Test Studio 1',
      leadType: 'interior_designer',
      country: 'UAE',
      city: 'Dubai',
      source: 'manual',
      dedupeKey: 'del_test_1',
      status: 'new'
    });

    // 2. Create a campaign & campaign lead
    const campaign = await Campaign.create({
      userId: userIdA,
      name: 'Spring Outreach Campaign',
      status: 'draft'
    });
    await CampaignLead.create({
      userId: userIdA,
      campaignId: campaign.id,
      leadId: lead.id
    });

    // 3. Create call, follow up, note, task
    await Call.create({
      userId: userIdA,
      leadId: lead.id,
      direction: 'outbound',
      outcome: 'connected',
      durationSec: 120
    });

    await FollowUp.create({
      userId: userIdA,
      leadId: lead.id,
      channel: 'call',
      status: 'pending',
      dueAt: new Date()
    });

    await Note.create({
      userId: userIdA,
      ownerType: 'lead',
      ownerId: String(lead.id),
      title: 'Design preferences',
      body: 'Prefers botanical silk abrash'
    });

    const task = await Task.create({
      userId: userIdA,
      title: 'Send yarn swatches',
      relatedLeadId: lead.id,
      status: 'todo'
    });

    // 4. Send DELETE request
    const res = await request(app)
      .delete(`/api/leads/${lead.id}`)
      .set('x-test-user-id', userIdA);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 5. Verify lead is gone
    const foundLead = await Lead.findByPk(lead.id);
    expect(foundLead).toBeNull();

    // 6. Verify children cleaned up
    const foundCl = await CampaignLead.findOne({ where: { leadId: lead.id } });
    expect(foundCl).toBeNull();

    const foundCall = await Call.findOne({ where: { leadId: lead.id } });
    expect(foundCall).toBeNull();

    const foundFollowUp = await FollowUp.findOne({ where: { leadId: lead.id } });
    expect(foundFollowUp).toBeNull();

    const foundNote = await Note.findOne({ where: { ownerType: 'lead', ownerId: String(lead.id) } });
    expect(foundNote).toBeNull();

    // 7. Verify Task preserved but relatedLeadId unlinked
    const updatedTask = await Task.findByPk(task.id);
    expect(updatedTask).not.toBeNull();
    expect(updatedTask.relatedLeadId).toBeNull();
  });

  it('POST /api/leads/bulk-delete deletes multiple leads and cascades child records cleanly', async () => {
    // Create 3 leads
    const l1 = await Lead.create({ userId: userIdA, businessName: 'Bulk Lead 1', leadType: 'interior_designer', country: 'UAE', city: 'Dubai', source: 'manual', dedupeKey: 'bulk_1', status: 'new' });
    const l2 = await Lead.create({ userId: userIdA, businessName: 'Bulk Lead 2', leadType: 'interior_designer', country: 'UAE', city: 'Dubai', source: 'manual', dedupeKey: 'bulk_2', status: 'new' });
    const l3 = await Lead.create({ userId: userIdA, businessName: 'Bulk Lead 3', leadType: 'interior_designer', country: 'UAE', city: 'Dubai', source: 'manual', dedupeKey: 'bulk_3', status: 'new' });

    const campaign = await Campaign.create({ userId: userIdA, name: 'Bulk Test Campaign', status: 'active' });
    await CampaignLead.create({ userId: userIdA, campaignId: campaign.id, leadId: l1.id });
    await CampaignLead.create({ userId: userIdA, campaignId: campaign.id, leadId: l2.id });

    await Call.create({ userId: userIdA, leadId: l1.id, outcome: 'connected', direction: 'outbound' });
    await Note.create({ userId: userIdA, ownerType: 'lead', ownerId: String(l2.id), title: 'Note 2', body: 'Note 2 body' });

    const res = await request(app)
      .post('/api/leads/bulk-delete')
      .set('x-test-user-id', userIdA)
      .send({ ids: [l1.id, l2.id, l3.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBe(3);

    const remaining = await Lead.count({ where: { userId: userIdA } });
    expect(remaining).toBe(0);

    const remainingCl = await CampaignLead.count({ where: { userId: userIdA } });
    expect(remainingCl).toBe(0);
  });

  it('enforces tenant isolation: User A cannot bulk-delete User B leads', async () => {
    const leadB = await Lead.create({ userId: userIdB, businessName: 'User B Secret Lead', leadType: 'interior_designer', country: 'UAE', city: 'Dubai', source: 'manual', dedupeKey: 'b_secret_1', status: 'new' });

    const res = await request(app)
      .post('/api/leads/bulk-delete')
      .set('x-test-user-id', userIdA)
      .send({ ids: [leadB.id] });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(0);

    // Lead B must still exist
    const stillExists = await Lead.findByPk(leadB.id);
    expect(stillExists).not.toBeNull();
  });
});
