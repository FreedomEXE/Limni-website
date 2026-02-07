import crypto from 'node:crypto';

const BITGET_API_KEY = 'bg_8c115b0f82be8713168033e77db44f68';
const BITGET_API_SECRET = '593ba6169d36f939267cf40c905e0566cc769032c4905a5144b2c9b74a4f9840';
const BITGET_API_PASSPHRASE = 'Fsociety2121';
const PRODUCT_TYPE = 'USDT-FUTURES';

function buildSignature(
  apiSecret: string,
  method: string,
  path: string,
  query: string,
  body: string,
  timestamp: string,
) {
  const prehash = `${timestamp}${method}${path}${query}${body}`;
  return crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');
}

async function testBitgetAccount() {
  const path = '/api/v2/mix/account/accounts';
  const query = `?productType=${PRODUCT_TYPE}`;
  const method = 'GET';
  const body = '';
  const timestamp = Date.now().toString();
  const signature = buildSignature(BITGET_API_SECRET, method, path, query, body, timestamp);

  const response = await fetch(`https://api.bitget.com${path}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'ACCESS-KEY': BITGET_API_KEY,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': BITGET_API_PASSPHRASE,
      locale: 'en-US',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Bitget request failed:', response.status, text);
    return;
  }

  const data = await response.json();
  console.log('\n=== BITGET API RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));

  const list = (data as any).data?.list ?? [];
  console.log('\n=== ACCOUNT LIST ===');
  for (const account of list) {
    console.log('marginCoin:', account.marginCoin);
    console.log('equity:', account.equity);
    console.log('usdtEquity:', account.usdtEquity);
    console.log('available:', account.available);
    console.log('---');
  }

  const preferred = list.find((row: any) => row.marginCoin?.toUpperCase() === 'USDT') ?? list[0];
  console.log('\n=== PREFERRED ACCOUNT ===');
  console.log(preferred);

  const analysisEquity = Number(
    preferred?.usdtEquity ?? preferred?.equity ?? preferred?.available ?? '0',
  );
  console.log('\n=== CALCULATED EQUITY ===');
  console.log('analysisEquity:', analysisEquity);
}

testBitgetAccount().catch(console.error);
