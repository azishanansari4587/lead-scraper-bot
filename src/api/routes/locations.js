/**
 * Locations API Router
 */

const express = require('express');
const Location = require('../../models/Location');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.country) where.country = req.query.country;
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true';

    const locations = await Location.findAll({
      where,
      order: [['priority', 'ASC'], ['country', 'ASC'], ['city', 'ASC']]
    });

    res.json({ success: true, locations });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { country, countryCode, state, city, priority = 10, isActive = true } = req.body;
    if (!country || !city) {
      return res.status(400).json({ error: 'ValidationError', message: 'country and city are required' });
    }

    const location = await Location.create({
      country,
      countryCode,
      state,
      city,
      priority,
      isActive
    });

    res.status(201).json({ success: true, location });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found' });
    }

    await location.update(req.body);
    res.json({ success: true, location });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found' });
    }

    await location.destroy();
    res.json({ success: true, message: 'Location deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
