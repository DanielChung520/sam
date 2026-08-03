// A3.1 verification: SeaweedFS S3 client
import { SeaweedFsClient } from './src/lib/seaweedFs.js';

async function main() {
  const client = new SeaweedFsClient();
  console.log(`endpoint: ${client.endpoint}`);
  console.log(`bucket: ${client.bucket}`);

  console.log('\n[1] ensureBucket');
  await client.ensureBucket();
  console.log('  OK');

  const key = 'test/' + Date.now() + '.txt';
  const content = 'hello seaweedfs ' + new Date().toISOString();

  console.log('\n[2] putObject');
  const put = await client.putObject(key, content, 'text/plain');
  console.log(`  OK (etag=${put.etag}, size=${put.size})`);

  console.log('\n[3] getObject');
  const got = await client.getObject(key);
  console.log(`  content: ${got.body.toString()}`);
  console.log(`  content-type: ${got.contentType}`);
  if (got.body.toString() !== content) throw new Error('content mismatch');
  console.log('  ✓ roundtrip match');

  console.log('\n[4] deleteObject');
  await client.deleteObject(key);
  console.log('  OK');

  console.log('\n[5] get after delete (should 404)');
  try {
    await client.getObject(key);
    throw new Error('expected 404');
  } catch (e) {
    console.log(`  ✓ ${String(e).slice(0, 60)}`);
  }

  console.log('\nALL SEAWEEDFS TESTS PASSED');
}

main().catch((e) => { console.error('FAIL:', e.message ?? e); process.exit(1); });