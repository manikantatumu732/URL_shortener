const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res) {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await User.create({ email, passwordHash, name });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      throw err;
    }

    const token = signToken(user._id.toString());
    res.cookie('accessToken', token, cookieOptions());

    return res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('[auth] register error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // passwordHash is select: false by default — explicitly select it.
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      // Same generic message as "no such user" — don't leak which failed.
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user._id.toString());
    res.cookie('accessToken', token, cookieOptions());

    return res.status(200).json({
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

async function logout(req, res) {
  res.clearCookie('accessToken', cookieOptions());
  return res.status(200).json({ success: true });
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // passwordHash is select: false, so it's excluded automatically.
    return res.status(200).json({
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('[auth] me error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = { register, login, logout, me };
