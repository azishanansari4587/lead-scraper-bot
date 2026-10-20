/**
 * Keywords API Router
 */

const express = require('express');
const KeywordSet = require('../../models/KeywordSet');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.leadType) where.leadType = req.query.leadType;
    if (req.query.language) where.language = req.query.language;

    const keywords = await KeywordSet.findAll({ where, order: [['leadType', 'ASC']] });
    res.json({ success: true, keywords });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { leadType, keywords, language = 'en', description, isActive = true } = req.body;
    if (!leadType || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'ValidationError', message: 'leadType and keywords array are required' });
    }

    const created = await KeywordSet.create({
      leadType,
      keywords,
      language,
      description,
      isActive
    });

    res.status(201).json({ success: true, keywordSet: created });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const keywordSet = await KeywordSet.findByPk(req.params.id);
    if (!keywordSet) {
      return res.status(404).json({ error: 'NotFound', message: 'Keyword set not found' });
    }

    await keywordSet.update(req.body);
    res.json({ success: true, keywordSet });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const keywordSet = await KeywordSet.findByPk(req.params.id);
    if (!keywordSet) {
      return res.status(404).json({ error: 'NotFound', message: 'Keyword set not found' });
    }

    await keywordSet.destroy();
    res.json({ success: true, message: 'Keyword set deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
