let _bot = null;

function setBot(botInstance) {
  _bot = botInstance;
}

function getBot() {
  if (!_bot) {
    throw new Error('Bot not initialized yet');
  }
  return _bot;
}

module.exports = { setBot, getBot };
