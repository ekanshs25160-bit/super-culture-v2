import axios from 'axios';
import { ytService } from '../services/ytService.js';
import { SELFTEST_VIDEO_ID } from '../controllers/musicController.js';

async function checkStream() {
  try {
    const streamInfo = await ytService.resolveAudioStream(SELFTEST_VIDEO_ID, 'aac');
    const upstreamRes = await axios.get(streamInfo.url, {
      headers: { Range: 'bytes=0-1' },
      validateStatus: () => true,
      timeout: 10000,
    });

    if (upstreamRes.status === 200 || upstreamRes.status === 206) {
      console.log(JSON.stringify({ ok: true, status: upstreamRes.status }));
      process.exit(0);
    } else {
      console.log(JSON.stringify({ ok: false, error: `Upstream HTTP ${upstreamRes.status}` }));
      process.exit(1);
    }
  } catch (err: any) {
    console.error(JSON.stringify({ ok: false, error: err.message || 'Stream check failed' }));
    process.exit(1);
  }
}

checkStream();
