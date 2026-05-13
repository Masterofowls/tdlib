import axios from "axios";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || "mrdanauthbot";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://tdlib.vercel.app";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN environment variable is required!");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Storage
const userStore = new Map();
const otpStore = new Map();
const chatIdMap = new Map();
let lastUpdateId = 0;

// Helper functions
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    });
    console.log(`✅ Sent to ${chatId}`);
    return true;
  } catch (error) {
    console.error("Send error:", error.message);
    return false;
  }
}

function generateJWT(phoneNumber, userData) {
  return jwt.sign(
    {
      phoneNumber,
      chatId: userData.chatId,
      firstName: userData.firstName,
      username: userData.username,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// Process Telegram updates
async function processTelegramUpdate(update) {
  if (!update.message) return;

  const chatId = update.message.chat.id;
  const text = update.message.text;
  const user = update.message.from;

  console.log(`📨 Message from ${user.first_name}: ${text}`);

  // Store chat info
  chatIdMap.set(chatId.toString(), {
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    chatId: chatId,
  });

  if (text === "/start") {
    await sendTelegramMessage(
      chatId,
      `🤖 *Welcome to OTP Service!*\n\nHello ${user.first_name}! 👋\n\n` +
        `This bot will send you verification codes.\n\n` +
        `📱 *To get started:*\n` +
        `1. Visit ${FRONTEND_URL}\n` +
        `2. Enter your phone number\n` +
        `3. We'll send codes here!\n\n` +
        `Your Chat ID: \`${chatId}\``,
    );
  } else if (text === "/me") {
    const userData = userStore.get(chatId.toString());
    await sendTelegramMessage(
      chatId,
      `👤 *Your Profile*\n\n` +
        `Name: ${user.first_name} ${user.last_name || ""}\n` +
        `Username: @${user.username || "Not set"}\n` +
        `Chat ID: \`${chatId}\`\n` +
        `Phone: ${userData?.phoneNumber || "Not registered"}`,
    );
  }
}

// Polling loop
async function pollTelegram() {
  console.log("🔄 Starting Telegram polling loop...");

  while (true) {
    try {
      const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 30,
          allowed_updates: ["message"],
        },
      });

      const updates = response.data.result;
      if (updates && updates.length > 0) {
        for (const update of updates) {
          lastUpdateId = update.update_id;
          await processTelegramUpdate(update);
        }
      }
    } catch (error) {
      if (error.code !== "ECONNABORTED") {
        console.error("Polling error:", error.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}

// API Routes
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    botUsername: BOT_USERNAME,
    uptime: process.uptime(),
  });
});

app.get("/bot-info", (req, res) => {
  res.json({ botUsername: BOT_USERNAME });
});

app.post("/request-otp", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number required" });
  }

  // Find chat (in production, you'd map phone to chat)
  let chatId = null;
  for (const [cid] of chatIdMap) {
    chatId = cid;
    break;
  }

  if (!chatId) {
    return res.status(404).json({
      error: `Please send /start to @${BOT_USERNAME} on Telegram first`,
      needRegistration: true,
      botUsername: BOT_USERNAME,
    });
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  otpStore.set(phoneNumber, { otp, expiresAt, chatId });

  setTimeout(
    () => {
      if (otpStore.get(phoneNumber)?.expiresAt === expiresAt) {
        otpStore.delete(phoneNumber);
      }
    },
    5 * 60 * 1000,
  );

  const sent = await sendTelegramMessage(
    chatId,
    `🔐 *Verification Code*\n\nYour OTP code is: *${otp}*\n\nValid for 5 minutes.\n\nPhone: ${phoneNumber}`,
  );

  if (sent) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/verify-otp", (req, res) => {
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

  const chatInfo = chatIdMap.get(stored.chatId.toString());
  const token = generateJWT(phoneNumber, {
    chatId: stored.chatId,
    firstName: chatInfo?.firstName || "User",
    username: chatInfo?.username,
  });

  // Store user
  userStore.set(phoneNumber, {
    phoneNumber,
    chatId: stored.chatId,
    firstName: chatInfo?.firstName,
    username: chatInfo?.username,
    verifiedAt: Date.now(),
  });

  otpStore.delete(phoneNumber);

  res.json({
    success: true,
    token,
    user: {
      phoneNumber,
      firstName: chatInfo?.firstName,
      username: chatInfo?.username,
      chatId: stored.chatId,
    },
  });
});

app.get("/me", (req, res) => {
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
      username: userData.username,
      chatId: userData.chatId,
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Delete webhook and start polling
async function startBot() {
  try {
    await axios.post(`${TELEGRAM_API}/deleteWebhook`);
    console.log("✅ Webhook deleted");
  } catch (error) {
    console.log("No webhook to delete");
  }

  // Start polling in background
  pollTelegram();

  // Start API server
  app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`🤖 Bot: @${BOT_USERNAME}`);
    console.log(`🌐 Frontend: ${FRONTEND_URL}`);
  });
}

startBot();
