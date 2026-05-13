import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// In-memory user storage (use Redis/DB in production)
const userStore = new Map();


// ============= HELPER FUNCTIONS =============

/**
 * Verify Telegram Login Widget data
 * @param {Object} data - Data from Telegram Login Widget
 * @returns {boolean} - True if data is valid
 */
function verifyTelegramData(data) {
  if (!data.id || !data.hash || !BOT_TOKEN) {
    return false;
  }

  // Create data string for verification
  const dataCheckString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  // Create HMAC
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return hash === data.hash;
}

/**
 * Generate JWT token for authenticated user
 * @param {Object} userData - User data from Telegram
 * @returns {string} - JWT token
 */
function generateJWT(userData) {
  return jwt.sign(
    {
      telegramId: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      username: userData.username,
      photoUrl: userData.photo_url,
    },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token or null if invalid
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}


// ============= HEALTH CHECK =============
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

// ============= TELEGRAM LOGIN VERIFICATION =============
/**
 * Verify Telegram Login Widget data and authenticate user
 * POST /api/auth/telegram
 * Body: { id, first_name, last_name, username, photo_url, hash, auth_date }
 */
app.post('/api/auth/telegram', (req, res) => {
  const telegramData = req.body;

  // Verify the data signature from Telegram
  if (!verifyTelegramData(telegramData)) {
    return res.status(401).json({
      error: 'Invalid Telegram data signature',
      success: false,
    });
  }

  // Check if user already exists
  const existingUser = userStore.get(telegramData.id.toString());

  // Create or update user
  const userData = {
    id: telegramData.id,
    first_name: telegramData.first_name,
    last_name: telegramData.last_name || '',
    username: telegramData.username || '',
    photo_url: telegramData.photo_url || '',
    auth_date: telegramData.auth_date,
    loginCount: (existingUser?.loginCount || 0) + 1,
    lastLogin: Date.now(),
    createdAt: existingUser?.createdAt || Date.now(),
  };

  // Store user
  userStore.set(telegramData.id.toString(), userData);

  // Generate JWT token
  const token = generateJWT(userData);

  res.json({
    success: true,
    token,
    user: {
      telegramId: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      username: userData.username,
      photoUrl: userData.photo_url,
    },
  });
});

// ============= GET CURRENT USER =============
/**
 * Get current authenticated user profile
 * GET /api/me
 * Header: Authorization: Bearer <token>
 */
app.get('/api/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyJWT(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userData = userStore.get(decoded.telegramId.toString());
  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    success: true,
    user: {
      telegramId: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      username: userData.username,
      photoUrl: userData.photo_url,
      loginCount: userData.loginCount,
      lastLogin: userData.lastLogin,
      createdAt: userData.createdAt,
    },
  });
});

// ============= LOGOUT =============
/**
 * Logout user (invalidate token on client side)
 * POST /api/logout
 */
app.post('/api/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// ============= LIST ALL USERS (DEBUG ONLY) =============
app.get('/api/admin/users', (req, res) => {
  const users = Array.from(userStore.values()).map((user) => ({
    telegramId: user.id,
    firstName: user.first_name,
    username: user.username,
    loginCount: user.loginCount,
    lastLogin: new Date(user.lastLogin).toISOString(),
  }));

  res.json({ totalUsers: users.length, users });
});

// Handle OPTIONS for all routes
app.options('/api/*', (req, res) => {
  res.status(200).end();
});

// Export for Vercel
export default app;
