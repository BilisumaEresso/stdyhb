#!/usr/bin/env node
/**
 * Setup Telegram Menu & Commands
 *
 * Configures the Telegram Bot Chat Menu Button to "commands" (drawer)
 * and registers the official command list so the menu button is never hijacked.
 */

require("dotenv").config();
const { Telegraf } = require("telegraf");
const { configureTelegramMenu, BOT_COMMANDS } = require("../src/bot/menuConfig");

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("❌ BOT_TOKEN is missing in environment variables.");
    process.exit(1);
  }

  console.log("Connecting to Telegram Bot API...");
  const bot = new Telegraf(token);

  try {
    const botInfo = await bot.telegram.getMe();
    console.log(`🤖 Bot Authenticated: @${botInfo.username} (${botInfo.id})`);

    console.log("Configuring Chat Menu Button & Commands...");
    const success = await configureTelegramMenu(bot, 3, 1000);

    if (success) {
      console.log("\n🎉 Telegram Menu setup completed successfully!");
      console.log("Commands registered:");
      BOT_COMMANDS.forEach((c) => {
        console.log(`  /${c.command} - ${c.description}`);
      });
    } else {
      console.error("\n❌ Failed to configure Telegram Menu.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Error setting up Telegram Menu:", err.message);
    process.exit(1);
  }
}

main();
