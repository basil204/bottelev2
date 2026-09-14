import { parseBotTokens } from '../config.js';
import assert from 'assert';

console.log('Testing parseBotTokens...');

// Case 1: Single token
const t1 = parseBotTokens('123456789:ABCdefGHIjklMNO123456');
assert.strictEqual(t1.length, 1);
assert.strictEqual(t1[0], '123456789:ABCdefGHIjklMNO123456');

// Case 2: Comma separated
const t2 = parseBotTokens('123456789:ABCdefGHIjklMNO123456, 987654321:ZYXwvuTSRqpoNML654321');
assert.strictEqual(t2.length, 2);
assert.strictEqual(t2[0], '123456789:ABCdefGHIjklMNO123456');
assert.strictEqual(t2[1], '987654321:ZYXwvuTSRqpoNML654321');

// Case 3: Newline separated
const t3 = parseBotTokens('123456789:ABCdefGHIjklMNO123456\n987654321:ZYXwvuTSRqpoNML654321\r\n1122334455:QwErTyUiOpAsDfG');
assert.strictEqual(t3.length, 3);

// Case 4: JSON array
const t4 = parseBotTokens('["123456789:ABCdefGHIjklMNO123456", "987654321:ZYXwvuTSRqpoNML654321"]');
assert.strictEqual(t4.length, 2);

// Case 5: Duplicates and invalid strings
const t5 = parseBotTokens('123456789:ABCdefGHIjklMNO123456, 123456789:ABCdefGHIjklMNO123456, invalid, short');
assert.strictEqual(t5.length, 1);

console.log('✅ parseBotTokens passed all tests!');
