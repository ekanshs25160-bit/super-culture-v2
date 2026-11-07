import { Innertube, Platform, UniversalCache } from 'youtubei.js';
import vm from 'node:vm';

Platform.shim.eval = async (data, env) => {
  const props = [];
  if (env.n) props.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) props.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = data.output && data.output.includes('return process(')
    ? data.output
    : `${data.output}\nreturn { ${props.join(', ')} }`;
  return vm.runInNewContext(`(function(){${code}})()`, Object.create(null), { timeout: 5000 });
};

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/client-matrix.mjs <videoId>');
  process.exit(1);
}

const yt = await Innertube.create({ cache: new UniversalCache(false), generate_session_locally: true });
const tries = [
  ['WEB', () => yt.getBasicInfo(id)],
  ['IOS', () => yt.getBasicInfo(id, { client: 'IOS' })],
  ['VISIONOS', () => yt.getBasicInfo(id, { client: 'VISIONOS' })],
  ['TV', () => yt.getBasicInfo(id, { client: 'TV' })],
  ['TV_EMBEDDED', () => yt.getBasicInfo(id, { client: 'TV_EMBEDDED' })],
  ['MWEB', () => yt.getBasicInfo(id, { client: 'MWEB' })],
  ['ANDROID', () => yt.getBasicInfo(id, { client: 'ANDROID' })],
  ['MUSIC', () => yt.music.getInfo(id)],
];

for (const [name, fn] of tries) {
  try {
    const info = await fn();
    const st = info.playability_status;
    let probe = '-';
    if (info.streaming_data) {
      const fmt = info.chooseFormat({ type: 'audio', quality: 'best' });
      const url = fmt.url ?? (await fmt.decipher(yt.session.player));
      const r = await fetch(url, { headers: { Range: 'bytes=0-1' } });
      probe = r.status;
    }
    console.log(name.padEnd(12), st?.status, '|', (st?.reason || '').slice(0, 40), '| formats:', !!info.streaming_data, '| probe:', probe);
  } catch (e) {
    console.log(name.padEnd(12), 'ERROR', e.message);
  }
}
