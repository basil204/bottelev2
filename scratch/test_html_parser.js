import { markdownToTelegramHtml, stripHtmlTags } from '../includes/helpers/telegramFormatHelper.js';

console.log('--- TEST 1: Telegram Desktop copy format ---');
console.log(markdownToTelegramHtml('![🛒](tg://emoji?id=5854776233950187351) **MUA HÀNG**'));

console.log('--- TEST 2: Shorthand {id:...} format ---');
console.log(markdownToTelegramHtml('{id:5854776233950187351} **MUA HÀNG**'));

console.log('--- TEST 3: Standard <tg-emoji> format ---');
console.log(markdownToTelegramHtml('<tg-emoji emoji-id="5854776233950187351">🛒</tg-emoji> **MUA HÀNG**'));

console.log('--- TEST 4: Strip HTML for Reply Keyboard Button ---');
console.log(stripHtmlTags('<tg-emoji emoji-id="5854776233950187351">🛒</tg-emoji> Mua tài khoản'));
