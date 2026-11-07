import { Innertube, Platform, UniversalCache, Log } from 'youtubei.js';
import vm from 'node:vm';
import axios from 'axios';

// Suppress noisy parser warnings during diagnostics
Log.setLevel(Log.Level.NONE);

// Evaluator shim for signature and n-token deciphering in youtubei.js
Platform.shim.eval = async (data, env) => {
  const props = [];
  if (env.n) props.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) props.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = data.output && data.output.includes('return process(')
    ? data.output
    : `${data.output}\nreturn { ${props.join(', ')} }`;
  return vm.runInNewContext(`(function(){${code}})()`, Object.create(null), { timeout: 5000 });
};

const videoId = process.argv[2] || '_SVxbdQR6Eg';

console.log(`\n================================================================================`);
console.log(` YouTube Client Throttle Diagnostic Matrix`);
console.log(` Target Video: ${videoId}`);
console.log(` Probing: Header (bytes=0-1) vs Deep (bytes=2097152-2097200 [2 MiB])`);
console.log(`================================================================================\n`);

const USER_AGENTS = {
  IOS: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
  ANDROID: 'com.google.android.youtube/19.44.38 (Linux; U; Android 14; en_US; Pixel 8 Pro Build/UQ1A.240205.004)',
  MWEB: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  WEB: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  TV: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/5.0 NativeTV/5.0 TV Safari/538.1',
  TV_EMBED: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/5.0 NativeTV/5.0 TV Safari/538.1',
  TV_EMBEDDED: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/5.0 NativeTV/5.0 TV Safari/538.1',
  WEB_CREATOR: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  VISIONOS: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
  MUSIC: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const yt = await Innertube.create({
  cache: new UniversalCache(false),
  generate_session_locally: true,
});

async function probeRange(url, userAgent, range) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        Range: range,
      },
      responseType: 'arraybuffer',
      validateStatus: () => true, // Do not throw on 4xx/5xx
      timeout: 7000,
    });
    return {
      status: res.status,
      length: res.data ? res.data.byteLength || res.data.length : 0,
      contentRange: res.headers['content-range'] || null,
    };
  } catch (err) {
    return {
      status: err.response?.status || err.code || 'ERR',
      length: 0,
      contentRange: null,
      error: err.message,
    };
  }
}

const clientsToTest = [
  { name: 'IOS', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'IOS' }) },
  { name: 'ANDROID', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'ANDROID' }) },
  { name: 'MWEB', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'MWEB' }) },
  { name: 'WEB', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'WEB' }) },
  { name: 'TV_EMBED', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'TV_EMBEDDED' }) },
  { name: 'TV', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'TV' }) },
  { name: 'WEB_CREATOR', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'WEB_CREATOR' }) },
  { name: 'VISIONOS', fetchInfo: () => yt.getBasicInfo(videoId, { client: 'VISIONOS' }) },
  { name: 'MUSIC', fetchInfo: () => yt.music.getInfo(videoId) },
];

const results = [];

for (const client of clientsToTest) {
  const ua = USER_AGENTS[client.name] || USER_AGENTS.WEB;
  let status = 'UNKNOWN';
  let headerProbe = '-';
  let deepProbe = '-';
  let verdict = 'FAILED';
  let details = '';

  try {
    const info = await client.fetchInfo();
    const playStatus = info.playability_status?.status || 'UNKNOWN';

    if (!info.streaming_data) {
      status = playStatus;
      verdict = 'NO_STREAMING_DATA';
      details = info.playability_status?.reason || 'No streams returned';
    } else {
      let format = null;
      try {
        format = info.chooseFormat({ type: 'audio', quality: 'best' });
      } catch {
        try {
          format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        } catch {}
      }

      if (!format) {
        status = playStatus;
        verdict = 'NO_AUDIO_FORMAT';
        details = 'No audio format matching criteria';
      } else {
        let streamUrl = format.url;
        if (!streamUrl) {
          try {
            streamUrl = await format.decipher(yt.session.player);
          } catch (decErr) {
            status = 'DECIPHER_FAILED';
            verdict = 'DECIPHER_FAILED';
            details = decErr.message || 'Decipher exception';
          }
        }

        if (streamUrl) {
          status = 'RESOLVED';
          details = `${format.mime_type?.split(';')[0] || 'audio'} | itag:${format.itag} | ${Math.round((format.bitrate || 0) / 1000)}kbps`;

          // 1. Header Probe: bytes=0-1
          const hProbe = await probeRange(streamUrl, ua, 'bytes=0-1');
          headerProbe = `${hProbe.status} (${hProbe.length}b)`;

          // 2. Deep Probe: bytes=2097152-2097200 (at 2 MiB boundary)
          const dProbe = await probeRange(streamUrl, ua, 'bytes=2097152-2097200');
          deepProbe = `${dProbe.status} (${dProbe.length}b)`;

          if (hProbe.status === 206 && dProbe.status === 206) {
            verdict = '✅ PASSED (NO THROTTLE)';
          } else if (hProbe.status === 206 && dProbe.status === 403) {
            verdict = '❌ 1 MiB THROTTLED (403 at 2MB)';
          } else {
            verdict = `⚠️ FAILED (H:${hProbe.status}, D:${dProbe.status})`;
          }
        }
      }
    }
  } catch (err) {
    status = 'ERROR';
    verdict = 'EXCEPTION';
    details = err.message || 'Execution error';
  }

  results.push({
    client: client.name,
    status,
    headerProbe,
    deepProbe,
    verdict,
    details,
  });

  console.log(`[${client.name.padEnd(11)}] Header: ${headerProbe.padEnd(10)} | Deep (2MB): ${deepProbe.padEnd(10)} | ${verdict}`);
  if (details && verdict.includes('NO_STREAM') || verdict.includes('EXCEPTION')) {
    console.log(`              Reason: ${details}`);
  }
}

console.log(`\n================================================================================`);
console.log(` Diagnostic Summary Table`);
console.log(`================================================================================`);
console.table(
  results.map((r) => ({
    Client: r.client,
    Resolution: r.status,
    '0-1 Probe': r.headerProbe,
    '2MB Probe': r.deepProbe,
    Verdict: r.verdict,
    Details: r.details.slice(0, 35),
  }))
);

const passed = results.filter((r) => r.verdict.includes('PASSED'));
const throttled = results.filter((r) => r.verdict.includes('1 MiB THROTTLED'));

console.log(`\nSummary:`);
console.log(`  Passed both probes:     ${passed.length} client(s) ${passed.map((p) => `[${p.client}]`).join(', ')}`);
console.log(`  1 MiB Throttled:        ${throttled.length} client(s) ${throttled.map((t) => `[${t.client}]`).join(', ')}`);
console.log(`================================================================================\n`);
