import { markdownToTelegramHtml, cleanButtonText } from '../includes/helpers/telegramFormatHelper.js';

console.log('--- TEST 1: Markdown Custom Emoji link ![⚠️](tg://emoji?id=5420323339723881652) ---');
console.log(markdownToTelegramHtml('![⚠️](tg://emoji?id=5420323339723881652) **MUA GMAIL EDU HỎA TỐC**'));

console.log('\n--- TEST 2: Standard link vs Emoji link ---');
console.log(markdownToTelegramHtml('[⚠️](tg://emoji?id=5420323339723881652) [Click vào đây](https://t.me/group)'));

console.log('\n--- TEST 3: Shorthand {id:5420323339723881652} ---');
console.log(markdownToTelegramHtml('{id:5420323339723881652} **DANH MỤC MUA HÀNG**'));

console.log('\n--- TEST 4: Button text cleaning ---');
console.log(cleanButtonText('![⚠️](tg://emoji?id=5420323339723881652) Mua Gmail EDU'));
console.log(cleanButtonText('{id:5420323339723881652} Mua Gmail EDU'));
