const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parsePaging = (q) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

// ---------------------------------------------------------------
// PUBLIC (no auth): enquiry form submission
// POST /api/enquiries/public
// Used by the online form and by counselors who share the form link.
// ---------------------------------------------------------------
router.post('/public', async (req, res, next) => {
  try {
    const { name, email, phone, course_interest, message } = req.body || {};
    if (!name || !email || !course_interest) {
      return res.status(400).json({ error: 'name, email and course_interest are required' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });

    const { rows } = await db.query(
      `INSERT INTO enquiries (name, email, phone, course_interest, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, course_interest, message, created_at`,
      [name.trim(), email.trim().toLowerCase(), phone || null, course_interest.trim(), message || null]
    );
    res.status(201).json({ message: 'Enquiry submitted', enquiry: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Everything below requires a valid JWT
router.use(authenticate);

// GET /api/enquiries/unclaimed  -> all public enquiries
router.get('/unclaimed', async (req, res, next) => {
  try {
    const { limit, page, offset } = parsePaging(req.query);
    const [data, count] = await Promise.all([
      db.query(
        `SELECT id, name, email, phone, course_interest, message, created_at
         FROM enquiries WHERE claimed_by IS NULL
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query('SELECT COUNT(*)::int AS total FROM enquiries WHERE claimed_by IS NULL'),
    ]);
    res.json({ page, limit, total: count.rows[0].total, enquiries: data.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/enquiries/mine  -> enquiries claimed by the logged-in user
router.get('/mine', async (req, res, next) => {
  try {
    const { limit, page, offset } = parsePaging(req.query);
    const [data, count] = await Promise.all([
      db.query(
        `SELECT id, name, email, phone, course_interest, message, created_at, claimed_at
         FROM enquiries WHERE claimed_by = $1
         ORDER BY claimed_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      ),
      db.query('SELECT COUNT(*)::int AS total FROM enquiries WHERE claimed_by = $1', [req.user.id]),
    ]);
    res.json({ page, limit, total: count.rows[0].total, enquiries: data.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/enquiries/:id/claim
// Single atomic UPDATE guarantees only one counselor wins a race.
router.post('/:id/claim', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid enquiry id' });

    const { rows } = await db.query(
      `UPDATE enquiries
       SET claimed_by = $1, claimed_at = NOW()
       WHERE id = $2 AND claimed_by IS NULL
       RETURNING id, name, email, phone, course_interest, message, created_at, claimed_at`,
      [req.user.id, id]
    );

    if (rows.length) return res.json({ message: 'Enquiry claimed', enquiry: rows[0] });

    const exists = await db.query('SELECT 1 FROM enquiries WHERE id = $1', [id]);
    if (!exists.rowCount) return res.status(404).json({ error: 'Enquiry not found' });
    return res.status(409).json({ error: 'Enquiry has already been claimed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
