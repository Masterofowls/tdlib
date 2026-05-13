// This is a Vercel Serverless Function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // For GET requests, just return status
  if (req.method === "GET") {
    res.status(200).json({
      status: "active",
      message: "Telegram webhook endpoint is ready",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle POST from Telegram
  if (req.method === "POST") {
    const update = req.body;
    console.log("📨 Received update:", JSON.stringify(update, null, 2));

    // Process the update
    if (update.message && update.message.text === "/start") {
      const chatId = update.message.chat.id;
      const user = update.message.from;
      const BOT_TOKEN = process.env.BOT_TOKEN;

      const welcomeMessage = `🤖 *Welcome to OTP Service!*\n\nHello ${user.first_name}! 👋\n\nThis bot will send you verification codes.\n\nVisit the website to get started:\nhttps://tdlib.vercel.app`;

      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeMessage,
            parse_mode: "Markdown",
          }),
        });
        console.log(`✅ Sent welcome message to ${chatId}`);
      } catch (error) {
        console.error("❌ Failed to send message:", error);
      }
    }

    res.status(200).json({ ok: true });
    return;
  }

  // Method not allowed
  res.status(405).json({ error: "Method not allowed" });
}
