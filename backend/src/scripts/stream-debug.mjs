import { Innertube, Platform, UniversalCache } from 'youtubei.js';
import vm from 'node:vm';

const VIDEO_ID = process.argv[2] || 'dQw4w9WgXcQ';

// Newer youtubei.js versions need an evaluator. If the README of your installed version
// shows a different signature, follow the README instead of this.
Platform.shim.eval = async (data, env) => {
  const props = [];
  if (env.n) props.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) props.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = `${data.output}\nreturn { ${props.join(', ')} }`;
  return vm.runInNewContext(`(function(){${code}})()`, Object.create(null), { timeout: 5000 });
};

const step = (name) => console.log(`\n--- ${name}`);

try {
  step('1. create client');
  const yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
  console.log('ok');

  step('2. basic info');
  const info = await yt.getBasicInfo(VIDEO_ID, { client: 'IOS' });
  console.log('playability:', info.playability_status?.status, info.playability_status?.reason || '');

  step('3. choose audio format');
  const fmt = info.chooseFormat({ type: 'audio', quality: 'best' });
  console.log('mime:', fmt.mime_type, '| bitrate:', fmt.bitrate, '| has url:', !!fmt.url);

  step('4. decipher');
  const url = await fmt.decipher(yt.session.player);
  console.log('url resolved:', !!url, url ? url.slice(0, 80) + '...' : '');

  step('5. request first 2 bytes');
  for (const [label, headers] of [
    ['no custom headers', { Range: 'bytes=0-1' }],
    ['browser user-agent', { Range: 'bytes=0-1', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' }],
  ]) {
    const res = await fetch(url, { headers });
    console.log(label, '->', res.status, res.headers.get('content-type'));
  }
} catch (err) {
  console.error('FAILED:', err?.message || err);
  process.exitCode = 1;
}