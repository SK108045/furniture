// Standalone Node 20.12+ script; no Express server or npm dependencies needed.
// Place a .env containing SWIFTA_API_KEY in the directory you run it from.
// Usage: node stk_test_script.js 0712345678 1
// Sends ONE real STK prompt. Never retries automatically.
async function main() {
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const key = process.env.SWIFTA_API_KEY?.trim();
  const phone = process.argv[2];
  const amount = Number(process.argv[3] || '1');
  if (!key) throw new Error('Set SWIFTA_API_KEY in your environment or a local .env file.');
  if (!/^0[17]\d{8}$/.test(phone || '') || !Number.isSafeInteger(amount) || amount < 1) {
    throw new Error('Usage: node stk_test_script.js 0712345678 1');
  }
  const reference = `NODE-${Date.now().toString(36).toUpperCase()}`;
  console.log(`Sending one STK request for KSh ${amount}. Reference: ${reference}`);
  const response = await fetch('https://app.swifta.co.ke/stkpush', {
    method: 'POST',
    headers: {'x-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify({phone, amount, accountReference: reference, description: 'AWS Node STK test'}),
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  console.log(JSON.stringify({
    httpStatus: response.status,
    contentType: response.headers.get('content-type'),
    server: response.headers.get('server'),
    cloudflareChallenge: response.headers.get('cf-mitigated'),
    rayId: response.headers.get('cf-ray'),
  }, null, 2));
  const raw = await response.text();
  try { console.log(JSON.stringify(JSON.parse(raw), null, 2)); }
  catch { console.log(raw.slice(0, 1200)); }
  if (!response.ok) process.exitCode = 1;
}
main().catch(error => {
  console.error(error.name, error.message);
  console.error('No automatic retry was made. If the request was sent, check its status before repeating it.');
  process.exitCode = 1;
});
