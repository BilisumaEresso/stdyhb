require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

async function login() {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Your phone number (+251...): "),
    password: async () => await input.text("2FA password (if set): "),
    phoneCode: async () => await input.text("Code from Telegram: "),
    onError: (err) => console.error(err),
  });

  const session = client.session.save();
  console.log("\n✅ Login successful!");
  console.log("\nCopy this into your .env as TELEGRAM_SESSION=");
  console.log("\n" + session + "\n");

  await client.disconnect();
}

login();
