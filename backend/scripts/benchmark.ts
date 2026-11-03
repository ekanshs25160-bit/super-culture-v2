import request from 'supertest';
import { app } from '../src/index.js';
import { cacheService } from '../src/services/cacheService.js';

async function runBenchmark() {
  // Let startup background warming finish, then explicitly delete to simulate cold miss
  await new Promise((resolve) => setTimeout(resolve, 100));
  cacheService.delete('home-shelves');

  // 1. Cold Call (Cache MISS)
  const coldStart = process.hrtime.bigint();
  const resCold = await request(app).get('/api/music/home-shelves');
  const coldEnd = process.hrtime.bigint();
  const coldMs = Number(coldEnd - coldStart) / 1_000_000;

  // 2. Cached Calls (Cache HITs)
  const cachedTimings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = process.hrtime.bigint();
    const resCached = await request(app).get('/api/music/home-shelves');
    const end = process.hrtime.bigint();
    cachedTimings.push(Number(end - start) / 1_000_000);
  }

  const avgCachedMs = cachedTimings.reduce((a, b) => a + b, 0) / cachedTimings.length;

  console.log('\n================ TIMING BENCHMARK RESULTS ================');
  console.log('Endpoint: /api/music/home-shelves');
  console.log(`Cold Call (Cache MISS):   ${coldMs.toFixed(2)} ms (Status: ${resCold.status}, X-Cache: ${resCold.headers['x-cache']})`);
  cachedTimings.forEach((t, idx) => {
    console.log(`Cached Call #${idx + 1} (Cache HIT): ${t.toFixed(2)} ms`);
  });
  console.log(`Cached Average (HIT):     ${avgCachedMs.toFixed(2)} ms`);
  console.log(`Latency Reduction:        ${((1 - avgCachedMs / coldMs) * 100).toFixed(1)}%`);
  console.log(`Speedup Factor:           ${(coldMs / avgCachedMs).toFixed(1)}x faster`);
  console.log('==========================================================\n');

  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
