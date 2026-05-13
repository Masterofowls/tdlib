import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// In-memory storage (use Redis/DB in production)
const userStore = new Map(); // phoneNumber -> userData
const otpStore = new Map(); // phoneNumber -> { otp, expiresAt }
const pendingRegistrations = new Map(); // phoneNumber -> { chatId, expiresAt }

// ============= HELPER FUNCTIONS =============
// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate registration code (for first-time setup)
const generateRegCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

// Send message via bot
async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    });
    return true;
  } catch (error) {
    console.error('Telegram send error:', error.response?.data || error.message);
    return false;
  }
}

// Get user profile photo
async function getUserProfilePhoto(userId) {
  try {
    const photosResponse = await axios.post(`${TELEGRAM_API}/getUserProfilePhotos`, {
      user_id: userId,
      limit: 1
    });

    const photos = photosResponse.data.result;
    if (photos && photos.total_count > 0 && photos.photos.length > 0) {
      const fileId = photos.photos[0][0].file_id;
      const fileResponse = await axios.post(`${TELEGRAM_API}/getFile`, {
        file_id: fileId
      });
      const filePath = fileResponse.data.result.file_path;
      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Generate JWT for user
function generateJWT(userData) {
  return jwt.sign(
    {
      phoneNumber: userData.phoneNumber,
      chatId: userData.chatId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      authMethod: 'otp'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ============= WEBHOOK - Handle Telegram messages =============
app.post('/webhook', async (req, res) => {
  const update = req.body;

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;
    const user = update.message.from;

    // Handle /start command
    if (text === '/start') {
      // Check if this chat is waiting for registration
      let pendingPhone = null;
      for (const [phone, data] of pendingRegistrations.entries()) {
        if (data.chatId === chatId) {
          pendingPhone = phone;
          break;
        }
      }

      if (pendingPhone) {
        // Complete registration
        const regData = pendingRegistrations.get(pendingPhone);
        if (regData && regData.chatId === chatId) {
          // Store user
          userStore.set(pendingPhone, {
            phoneNumber: pendingPhone,
            chatId: chatId,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username,
            verified: true,
            registeredAt: Date.now()
          });

          // Clean up
          pendingRegistrations.delete(pendingPhone);

          await sendTelegramMessage(
            chatId,
            `✅ *Phone Number Verified!*\n\nYour phone number ${pendingPhone} has been successfully registered.\n\nYou can now log in using OTP codes.\n\nSend /me to see your profile.`
          );

          res.sendStatus(200);
          return;
        }
      }

      // Regular welcome message
      const welcomeMessage = `🤖 *Welcome to OTP Service!*\n\nHello ${user.first_name}! 👋\n\nThis bot will send you verification codes for logging into our web app.\n\n*Commands:*\n/me - View your profile\n/help - Show this message\n\nTo get started, visit our website and enter your phone number.`;

      await sendTelegramMessage(chatId, welcomeMessage);
    }

    // Handle /me command
    else if (text === '/me') {
      let userData = null;
      for (const [phone, data] of userStore.entries()) {
        if (data.chatId === chatId) {
          userData = data;
          break;
        }
      }

      if (userData) {
        const profilePhoto = await getUserProfilePhoto(chatId);
        const profileMessage = `👤 *Your Profile*\n\n` +
          `Name: ${userData.firstName} ${userData.lastName || ''}\n` +
          `Username: @${userData.username || 'Not set'}\n` +
          `Phone: ${userData.phoneNumber}\n` +
          `Verified: ✅ Yes\n` +
          `Registered: ${new Date(userData.registeredAt).toLocaleString()}`;

        await sendTelegramMessage(chatId, profileMessage);

        if (profilePhoto) {
          await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: profilePhoto,
            caption: "Your profile picture"
          });
        }
      } else {
        await sendTelegramMessage(chatId, `❌ *Not Registered*\n\nYou haven't registered your phone number yet.\n\nVisit our website to register.`);
      }
    }

    // Handle /help command
    else if (text === '/help') {
      const helpMessage = `📚 *Help*\n\n` +
        `*How to use:*\n` +
        `1. Visit our website\n` +
        `2. Enter your phone number\n` +
        `3. We'll send a code here\n` +
        `4. Enter the code on the website\n\n` +
        `*Commands:*\n` +
        `/me - View your profile\n` +
        `/help - Show this message`;

      await sendTelegramMessage(chatId, helpMessage);
    }
  }

  res.sendStatus(200);
});

// ============= API: Request OTP (Step 1) =============
app.post('/api/request-otp', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Check if user exists
  let userData = userStore.get(phoneNumber);
  let chatId = userData?.chatId;

  // If user doesn't exist, generate registration code
  if (!userData) {
    // Generate a temporary registration code
    const regCode = generateRegCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    pendingRegistrations.set(phoneNumber, {
      phoneNumber,
      regCode,
      expiresAt,
      status: 'pending'
    });

    // Send registration link via bot (user needs to start bot first)
    // For now, we'll inform them to start the bot
    return res.status(404).json({
      error: 'Phone number not registered',
      needRegistration: true,
      botUsername: BOT_USERNAME,
      message: `Please open Telegram, search for @${BOT_USERNAME}, send /start, then try again.`
    });
  }

  // User exists, send OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore.set(phoneNumber, { otp, expiresAt });

  setTimeout(() => {
    if (otpStore.get(phoneNumber)?.expiresAt === expiresAt) {
      otpStore.delete(phoneNumber);
    }
  }, 5 * 60 * 1000);

  const sent = await sendTelegramMessage(
    chatId,
    `🔐 *Verification Code*\n\nYour OTP code is: *${otp}*\n\nValid for 5 minutes.\n\nEnter this code on the website to complete login.`
  );

  if (sent) {
    res.json({ success: true, message: 'OTP sent to your Telegram' });
  } else {
    res.status(500).json({ error: 'Failed to send OTP. Please ensure you have started the bot.' });
  }
});

// ============= API: Verify OTP (Step 2) =============
app.post('/api/verify-otp', (req, res) => {
  const { phoneNumber, otp } = req.body;

  const stored = otpStore.get(phoneNumber);

  if (!stored) {
    return res.status(400).json({ error: 'No OTP requested for this number' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phoneNumber);
    return res.status(400).json({ error: 'OTP has expired' });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  // Get user data
  const userData = userStore.get(phoneNumber);

  if (!userData) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Generate JWT token
  const token = generateJWT(userData);

  // Get profile photo
  const profilePhoto = await getUserProfilePhoto(userData.chatId);

  otpStore.delete(phoneNumber);

  res.json({
    success: true,
    token,
    user: {
      phoneNumber: userData.phoneNumber,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      chatId: userData.chatId,
      profilePhoto
    }
  });
});

// ============= API: Register phone number (first time) =============
app.post('/api/register', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Check if already registered
  if (userStore.has(phoneNumber)) {
    return res.status(400).json({ error: 'Phone number already registered' });
  }

  // Generate registration code
  const regCode = generateRegCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  pendingRegistrations.set(phoneNumber, {
    phoneNumber,
    regCode,
    expiresAt,
    status: 'pending'
  });

  // Send instruction to user (they need to start bot)
  res.json({
    success: true,
    needBotStart: true,
    botUsername: BOT_USERNAME,
    message: `Please open Telegram, search for @${BOT_USERNAME}, send /start, then request OTP again.`,
    regCode // For debugging
  });
});

// ============= API: Complete registration via webhook (called from bot) =============
// This is handled by the webhook endpoint above

// ============= API: Get current user from JWT =============
app.get('/api/me', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get fresh user data
    const userData = userStore.get(decoded.phoneNumber);

    if (!userData) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get fresh profile photo
    const profilePhoto = await getUserProfilePhoto(userData.chatId);

    res.json({
      phoneNumber: userData.phoneNumber,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      chatId: userData.chatId,
      profilePhoto,
      registeredAt: userData.registeredAt
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ============= API: Logout =============
app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// ============= API: Bot info =============
app.get('/api/bot-info', (req, res) => {
  res.json({ botUsername: BOT_USERNAME });
});

// ============= API: Check registration status =============
app.get('/api/check-registration/:phoneNumber', (req, res) => {
  const { phoneNumber } = req.params;

  const isRegistered = userStore.has(phoneNumber);
  const isPending = pendingRegistrations.has(phoneNumber);

  res.json({
    phoneNumber,
    isRegistered,
    isPending,
    botUsername: BOT_USERNAME
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Configured' : 'MISSING!'}`);
});
