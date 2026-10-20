/**
 * Search Presets API Router
 */

const express = require('express');
const SearchPreset = require('../../models/SearchPreset');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const presets = await SearchPreset.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, presets });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, leadTypes, country, state, city, customKeyword, minRating, minReviews, hasWebsite, hasEmail, hasPhone, hasWhatsapp, minScore } = req.body;
    if (!name || !country) {
      return res.status(400).json({ error: 'ValidationError', message: 'name and country are required' });
    }

    const preset = await SearchPreset.create({
      userId: req.userId,
      name,
      leadTypes: leadTypes || [],
      country,
      state,
      city,
      customKeyword,
      minRating,
      minReviews,
      hasWebsite: !!hasWebsite,
      hasEmail: !!hasEmail,
      hasPhone: !!hasPhone,
      hasWhatsapp: !!hasWhatsapp,
      minScore: minScore || 0
    });

    res.status(201).json({ success: true, preset });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const preset = await SearchPreset.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!preset) {
      return res.status(404).json({ error: 'NotFound', message: 'Preset not found' });
    }

    const { id: _, userId: __, ...updates } = req.body;
    await preset.update(updates);
    res.json({ success: true, preset });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const preset = await SearchPreset.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!preset) {
      return res.status(404).json({ error: 'NotFound', message: 'Preset not found' });
    }

    await preset.destroy();
    res.json({ success: true, message: 'Preset deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
