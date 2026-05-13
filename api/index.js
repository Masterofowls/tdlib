import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const JWT_SECRET = process.env.JWT_SECRET;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// In-memory storage (use Redis/DB in production)
const userStore = new Map();
const otpStore = new Map();
const pendingRegistrations = new Map();

// ============= HELPER FUNCTIONS =============
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

async function sendTelegramMessage(chatId, text, parseMode = "Markdown") {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    });
    return true;
  } catch (error) {
    console.error(
      "Telegram send error:",
      error.response?.data || error.message,
    );
    return false;
  }
}

function generateJWT(userData) {
  return jwt.sign(
    {
      phoneNumber: userData.phoneNumber,
      chatId: userData.chatId,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// ============= HEALTH CHECK =============
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    botUsername: BOT_USERNAME,
  });
});

// ============= WEBHOOK ENDPOINT =============
app.post("/api/webhook", async (req, res) => {
  const update = req.body;
  console.log("📨 Webhook received:", JSON.stringify(update, null, 2));

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (update.message && update.message.text === "/start") {
    const chatId = update.message.chat.id;
    const user = update.message.from;

    // Check if this chat is waiting for registration
    let pendingPhone = null;
    for (const [phone, data] of pendingRegistrations.entries()) {
      if (data.chatId === chatId) {
        pendingPhone = phone;
        break;
      }
    }

    if (pendingPhone) {
      const regData = pendingRegistrations.get(pendingPhone);
      if (regData && regData.chatId === chatId) {
        userStore.set(pendingPhone, {
          phoneNumber: pendingPhone,
          chatId: chatId,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          verified: true,
          registeredAt: Date.now(),
        });
        pendingRegistrations.delete(pendingPhone);

        await sendTelegramMessage(
          chatId,
          `✅ *Phone Number Verified!*\n\nYour phone number ${pendingPhone} has been successfully registered.\n\nYou can now log in using OTP codes.\n\nSend /me to see your profile.`,
        );
        res.status(200).json({ ok: true });
        return;
      }
    }

    // Regular welcome message
    const welcomeMessage = `🤖 *Welcome to OTP Service!*\n\nHello ${user.first_name}! 👋\n\nThis bot will send you verification codes for logging into our web app.\n\n*Commands:*\n/me - View your profile\n/start - Show this message\n\nTo get started, visit our website and enter your phone number.\n\nWebsite: https://tdlib.vercel.app`;

    await sendTelegramMessage(chatId, welcomeMessage);
  }

  // Handle /me command
  else if (update.message && update.message.text === "/me") {
    const chatId = update.message.chat.id;
    let userData = null;

    for (const [phone, data] of userStore.entries()) {
      if (data.chatId === chatId) {
        userData = data;
        break;
      }
    }

    if (userData) {
      const profileMessage =
        `👤 *Your Profile*\n\n` +
        `Name: ${userData.firstName} ${userData.lastName || ""}\n` +
        `Username: @${userData.username || "Not set"}\n` +
        `Phone: ${userData.phoneNumber}\n` +
        `Verified: ✅ Yes\n` +
        `Registered: ${new Date(userData.registeredAt).toLocaleString()}`;

      await sendTelegramMessage(chatId, profileMessage);
    } else {
      await sendTelegramMessage(
        chatId,
        `❌ *Not Registered*\n\nYou haven't registered your phone number yet.\n\nVisit our website to register.`,
      );
    }
  }

  res.status(200).json({ ok: true });
});

// ============= API: BOT INFO =============
app.get("/api/bot-info", (req, res) => {
  res.json({ botUsername: BOT_USERNAME });
});

// ============= API: REQUEST OTP =============
app.post("/api/request-otp", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number required" });
  }

  let userData = userStore.get(phoneNumber);

  if (!userData) {
    // Generate temporary registration
    const expiresAt = Date.now() + 10 * 60 * 1000;
    pendingRegistrations.set(phoneNumber, {
      phoneNumber,
      expiresAt,
      status: "pending",
    });

    return res.status(404).json({
      error: "Phone number not registered",
      needRegistration: true,
      botUsername: BOT_USERNAME,
    });
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  otpStore.set(phoneNumber, { otp, expiresAt });

  setTimeout(
    () => {
      if (otpStore.get(phoneNumber)?.expiresAt === expiresAt) {
        otpStore.delete(phoneNumber);
      }
    },
    5 * 60 * 1000,
  );

  const sent = await sendTelegramMessage(
    userData.chatId,
    `🔐 *Verification Code*\n\nYour OTP code is: *${otp}*\n\nValid for 5 minutes.\n\nEnter this code on the website to complete login.`,
  );

  if (sent) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ============= API: VERIFY OTP =============
app.post("/api/verify-otp", (req, res) => {
  const { phoneNumber, otp } = req.body;

  const stored = otpStore.get(phoneNumber);

  if (!stored) {
    return res.status(400).json({ error: "No OTP requested" });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phoneNumber);
    return res.status(400).json({ error: "OTP expired" });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  const userData = userStore.get(phoneNumber);

  if (!userData) {
    return res.status(404).json({ error: "User not found" });
  }

  const token = generateJWT(userData);
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
    },
  });
});

// ============= API: GET USER PROFILE =============
app.get("/api/me", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userData = userStore.get(decoded.phoneNumber);

    if (!userData) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      phoneNumber: userData.phoneNumber,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      chatId: userData.chatId,
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ============= API: REGISTER PHONE =============
app.post("/api/register", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number required" });
  }

  if (userStore.has(phoneNumber)) {
    return res.status(400).json({ error: "Phone number already registered" });
  }

  const expiresAt = Date.now() + 10 * 60 * 1000;
  pendingRegistrations.set(phoneNumber, {
    phoneNumber,
    expiresAt,
    status: "pending",
  });

  res.json({
    success: true,
    needBotStart: true,
    botUsername: BOT_USERNAME,
  });
});

// ============= API: CHECK REGISTRATION STATUS =============
app.get("/api/check-registration/:phoneNumber", (req, res) => {
  const { phoneNumber } = req.params;

  const isRegistered = userStore.has(phoneNumber);
  const isPending = pendingRegistrations.has(phoneNumber);

  res.json({
    phoneNumber,
    isRegistered,
    isPending,
    botUsername: BOT_USERNAME,
  });
});

// ============= API: LOGOUT =============
app.post("/api/logout", (req, res) => {
  res.json({ success: true });
});

// Handle OPTIONS for all routes
app.options("/api/*", (req, res) => {
  res.status(200).end();
});

// Export for Vercel
export default app;
