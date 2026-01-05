import fs from 'fs';
import path from 'path';
import color from '../lib/color.js';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, 'bot.log');

const append = (line) => {
  fs.appendFile(logFile, line + '\n', () => {});
};

export const logUser = (user, message) => {
  const line = `[USER] ${user.id} | ${user.username || 'n/a'} | ${message}`;
  console.log(color.cyan(line));
  append(line);
};

export const logAdmin = (userId, command) => {
  const line = `[ADMIN] ${userId} | ${command}`;
  console.log(color.yellow(line));
  append(line);
};

export const logEvent = (event, payload = {}) => {
  const line = `[EVENT] ${event} | ${JSON.stringify(payload)}`;
  console.log(color.green(line));
  append(line);
};

export const logError = (err) => {
  let payload = err;
  let message = '';

  if (err instanceof Error) {
    message = err.message;
    payload = {
      message: err.message,
      stack: err.stack
    };
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    message = err.message || JSON.stringify(err);
  } else {
    message = String(err);
  }

  const line = `[ERROR] ${message} | ${JSON.stringify(payload)}`;
  console.error(color.red(line));
  append(line);
};

