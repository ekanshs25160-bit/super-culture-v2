import { Platform } from 'youtubei.js';
import vm from 'node:vm';

/**
 * Custom JavaScript evaluator shim for youtubei.js signature and n-sig deciphering.
 * Evaluates in a secure sandbox context with a 5000ms execution timeout.
 */
Platform.shim.eval = async (data: any, env: Record<string, any>) => {
  const properties: string[] = [];
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = data.output.includes('return process(')
    ? data.output
    : `${data.output}\nreturn { ${properties.join(', ')} }`;
  return vm.runInNewContext(`(function(){${code}})()`, Object.create(null), { timeout: 5000 });
};
