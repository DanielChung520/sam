import { getFileStorage } from './src/lib/fileStorage.js';
const storage = getFileStorage();
console.log('storage type:', storage.constructor.name);

const key = 'test/' + Date.now() + '.txt';
const content = Buffer.from('hello file storage ' + new Date().toISOString());

console.log('\n[1] put');
const r = await storage.put(key, content, 'text/plain');
console.log('  size:', r.size);

console.log('\n[2] get');
const got = await storage.get(key);
console.log('  body:', got.body.toString());
console.log('  type:', got.contentType);
if (got.body.toString() !== content.toString()) throw new Error('mismatch');
console.log('  ✓ roundtrip');

console.log('\n[3] delete');
await storage.delete(key);
console.log('  OK');

console.log('\nALL OK');
