const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, user_type } = req.body;

    // Validation
    if (!name || !email || !password || !user_type) {
      return res.status(400).json({
        error: {
          message: 'All fields are required',
          status: 400
        }
      });
    }

    if (user_type !== 'user' && user_type !== 'organisation') {
      return res.status(400).json({
        error: {
          message: 'Invalid user type. Must be "user" or "organisation"',
          status: 400
        }
      });
    }

    // Check if user already exists
    const checkUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (checkUser.rows.length > 0) {
      return res.status(409).json({
        error: {
          message: 'Email already registered',
          status: 409
        }
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user or organisation
    let query, params;
    if (user_type === 'user') {
      query = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING user_id, name, email, created_at';
      params = [name, email, hashedPassword];
    } else {
      query = 'INSERT INTO organisations (company_name, email, password) VALUES ($1, $2, $3) RETURNING org_id, company_name, email, created_at';
      params = [name, email, hashedPassword];
    }

    const result = await pool.query(query, params);
    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user_type === 'user' ? user.user_id : user.org_id,
        user_type: user_type,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user_type === 'user' ? user.user_id : user.org_id,
        name: user_type === 'user' ? user.name : user.company_name,
        email: user.email,
        user_type
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          status: 400
        }
      });
    }

    // Try user first
    let userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    let user_type = 'user';
    let user;

    if (userResult.rows.length === 0) {
      // Try organisation
      userResult = await pool.query(
        'SELECT * FROM organisations WHERE email = $1',
        [email]
      );
      user_type = 'organisation';
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: {
          message: 'Invalid email or password',
          status: 401
        }
      });
    }

    user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          message: 'Invalid email or password',
          status: 401
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user_type === 'user' ? user.user_id : user.org_id,
        user_type: user_type,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user_type === 'user' ? user.user_id : user.org_id,
        name: user_type === 'user' ? user.name : user.company_name,
        email: user.email,
        user_type
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        status: 500
      }
    });
  }
});

module.exports = router;
