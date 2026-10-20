/**
 * Recurring Schedules API Router
 */

const express = require('express');
const Schedule = require('../../models/Schedule');
const schedulerEngine = require('../../services/scheduler/schedulerEngine');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const schedules = await Schedule.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, schedules });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, cronExpression, leadTypes, country, state, city, enabled } = req.body;
    if (!name || !cronExpression || !country || !city) {
      return res.status(400).json({ error: 'ValidationError', message: 'name, cronExpression, country, and city are required' });
    }

    const schedule = await Schedule.create({
      userId: req.userId,
      name,
      cronExpression,
      leadTypes: leadTypes || ['rug_retailer'],
      country,
      state,
      city,
      enabled: enabled !== undefined ? !!enabled : true
    });

    schedulerEngine.reloadSchedules().catch(() => {});
    res.status(201).json({ success: true, schedule });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'NotFound', message: 'Schedule not found' });
    }

    const { id: _, userId: __, ...updates } = req.body;
    await schedule.update(updates);
    schedulerEngine.reloadSchedules().catch(() => {});
    res.json({ success: true, schedule });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'NotFound', message: 'Schedule not found' });
    }

    await schedule.update({ enabled: !schedule.enabled });
    schedulerEngine.reloadSchedules().catch(() => {});
    res.json({ success: true, enabled: schedule.enabled });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/run-now', async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'NotFound', message: 'Schedule not found' });
    }

    const result = await schedulerEngine.executeSchedule(schedule);
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'NotFound', message: 'Schedule not found' });
    }

    await schedule.destroy();
    schedulerEngine.reloadSchedules().catch(() => {});
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
