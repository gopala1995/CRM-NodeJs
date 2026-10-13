const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (emp) =>
  jwt.sign({ sub: emp.id, email: emp.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO employees (name, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, name, email, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    const employee = rows[0];
    res.status(201).json({ employee, token: signToken(employee) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await db.query('SELECT * FROM employees WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    const emp = rows[0];
    const ok = emp && (await bcrypt.compare(password, emp.password_hash));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({
      employee: { id: emp.id, name: emp.name, email: emp.email },
      token: signToken(emp),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
