export default (bot, handler) => {
  bot.on('callback_query', handler);
};

