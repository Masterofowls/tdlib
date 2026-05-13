import axios from 'axios';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || 'mrdanauthbot';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://tdlib.vercel.app';
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable is required!');
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============= HELPER FUNCTIONS =============

async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
    });
    console.log(`✅ Message sent to ${chatId}`);
    return true;
  } catch (error) {
    console.error(
      'Telegram API error:',
      error.response?.data || error.message,
    );
    return false;
  }
}

// ============= LONG POLLING (Get updates) =============

let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: {
        offset: lastUpdateId + 1,
        timeout: 30,
      },
    });

    const updates = response.data.result || [];

    for (const update of updates) {
      if (update.update_id > lastUpdateId) {
        lastUpdateId = update.update_id;
      }

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const user = update.message.from;

        console.log(
          `📨 Message from ${user.first_name}: "${text}" (Chat: ${chatId})`,
        );

        // Handle /start command
        if (text === '/start') {
          const welcomeMessage = `🤖 *Welcome to ${BOT_USERNAME}!*\n\nHello ${user.first_name}! 👋\n\n✨ This bot works with our secure web app for Telegram authentication.\n\n🔐 *How to use:*\n1. Visit ${FRONTEND_URL}\n2. Click "Login with Telegram"\n3. Verify with Telegram\n4. You're authenticated!\n\n📱 Your Chat ID: \`${chatId}\`\n\n🔗 Bot Username: @${BOT_USERNAME}`;

          await sendTelegramMessage(chatId, welcomeMessage);
        }

        // Handle /me command
        else if (text === '/me') {
          const profileMessage = `👤 *Your Profile*\n\nName: ${user.first_name} ${user.last_name || ''}\nUsername: @${user.username || 'Not set'}\nChat ID: \`${chatId}\``;

          await sendTelegramMessage(chatId, profileMessage);
        }

        // Handle /help command
        else if (text === '/help') {
          const helpMessage = `❓ *Available Commands*\n\n/start - Welcome message\n/me - View your profile\n/help - Show this help message\n\n🌐 Visit ${FRONTEND_URL} to authenticate and use our app.`;

          await sendTelegramMessage(chatId, helpMessage);
        }

        // Default response
        else {
          await sendTelegramMessage(
            chatId,
            `I'm a simple bot. Try /help for available commands.\n\n🌐 Go to ${FRONTEND_URL} to authenticate.`,
          );
        }
      }
    }
  } catch (error) {
    console.error('Poll error:', error.message);
  }
}

// ============= HEALTH CHECK =============

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    botUsername: BOT_USERNAME,
    timestamp: new Date().toISOString(),
  });
});

// ============= START BOT =============

console.log(`🤖 Starting Telegram Bot...`);
console.log(`✅ Bot Token: ${BOT_TOKEN.slice(0, 10)}***`);
console.log(`✅ Bot Username: @${BOT_USERNAME}`);
console.log(`✅ Frontend URL: ${FRONTEND_URL}`);

// Start polling for updates
setInterval(pollUpdates, 1000);

// Start express server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Polling for Telegram updates...`);
});
