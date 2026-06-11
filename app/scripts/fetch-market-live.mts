import { fetchLiquidationHeatmap, fetchLiquidationSummary } from '../src/lib/coinank.js';
import { fetchBitgetFuturesSnapshot } from '../src/lib/bitget.js';

console.log('Starting live market data fetch...');

try {
  const btcHeatmap = await fetchLiquidationHeatmap('BTC', { interval: '1d', exchanges: ['Binance', 'Bybit'], includeNodes: false });
  console.log('=== BTC LIQUIDATION HEATMAP (1d) ===');
  console.log(JSON.stringify(btcHeatmap, null, 2));
} catch(e: any) {
  console.error('BTC Heatmap Error:', e?.message || String(e));
}

try {
  const ethHeatmap = await fetchLiquidationHeatmap('ETH', { interval: '1d', exchanges: ['Binance', 'Bybit'], includeNodes: false });
  console.log('=== ETH LIQUIDATION HEATMAP (1d) ===');
  console.log(JSON.stringify(ethHeatmap, null, 2));
} catch(e: any) {
  console.error('ETH Heatmap Error:', e?.message || String(e));
}

try {
  const btcSummary = await fetchLiquidationSummary('BTC');
  console.log('=== BTC LIQUIDATION SUMMARY (6h) ===');
  console.log(JSON.stringify(btcSummary, null, 2));
} catch(e: any) {
  console.error('BTC Summary Error:', e?.message || String(e));
}

try {
  const ethSummary = await fetchLiquidationSummary('ETH');
  console.log('=== ETH LIQUIDATION SUMMARY (6h) ===');
  console.log(JSON.stringify(ethSummary, null, 2));
} catch(e: any) {
  console.error('ETH Summary Error:', e?.message || String(e));
}

try {
  const [btcSnap, ethSnap] = await Promise.all([
    fetchBitgetFuturesSnapshot('BTC'),
    fetchBitgetFuturesSnapshot('ETH'),
  ]);
  console.log('=== BTC BITGET SNAPSHOT ===');
  console.log(JSON.stringify(btcSnap, null, 2));
  console.log('=== ETH BITGET SNAPSHOT ===');
  console.log(JSON.stringify(ethSnap, null, 2));
} catch(e: any) {
  console.error('Bitget Error:', e?.message || String(e));
}

process.exit(0);
