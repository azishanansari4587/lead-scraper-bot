/**
 * OptOut Suppression List API Router
 */

const express = require('express');
const OptOut = require('../../models/OptOut');
const Lead = require('../../models/Lead');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const optouts = await OptOut.findAll({ order: [['requestedAt', 'DESC']] });
    res.json({ success: true, optouts });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, value, reason } = req.body;
    if (!type || !value) {
      return res.status(400).json({ error: 'ValidationError', message: 'type (email|domain|phone) and value are required' });
    }

    const cleanValue = String(value).trim().toLowerCase();
    const [optout, created] = await OptOut.findOrCreate({
      where: { type, value: cleanValue },
      defaults: { reason: reason || 'Requested via API' }
    });

    // Zero out score on any existing matching leads
    const whereMatch = {};
    if (type === 'email') whereMatch.email = cleanValue;
    else if (type === 'domain') whereMatch.domain = cleanValue;
    else if (type === 'phone') whereMatch.phone = cleanValue;

    await Lead.update(
      { score: 0, scoreReason: 'Suppressed via OptOut list (-100)' },
      { where: whereMatch }
    );

    res.status(201).json({ success: true, optout, created });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const optout = await OptOut.findByPk(req.params.id);
    if (!optout) {
      return res.status(404).json({ error: 'NotFound', message: 'OptOut entry not found' });
    }

    await optout.destroy();
    res.json({ success: true, message: 'OptOut entry removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
