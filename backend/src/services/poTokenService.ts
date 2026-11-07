import { Innertube, UniversalCache } from 'youtubei.js';
import { BG } from 'bgutils-js';
import { JSDOM } from 'jsdom';

export interface PoTokenPair {
  visitorData?: string;
  poToken?: string;
  expiresAt: number;
}

const PO_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
let cachedPoToken: PoTokenPair | null = null;
let poTokenPromise: Promise<{ visitorData?: string; poToken?: string }> | null = null;

export const invalidatePoToken = (): void => {
  cachedPoToken = null;
  poTokenPromise = null;
};

export const getPoToken = async (): Promise<{ visitorData?: string; poToken?: string }> => {
  if (cachedPoToken && cachedPoToken.expiresAt > Date.now()) {
    return {
      visitorData: cachedPoToken.visitorData,
      poToken: cachedPoToken.poToken,
    };
  }

  if (poTokenPromise) {
    return poTokenPromise;
  }

  poTokenPromise = (async () => {
    try {
      // 1. Obtain visitorData from ephemeral Innertube session
      const ephemeralClient = await Innertube.create({
        cache: new UniversalCache(false),
        retrieve_player: false,
        generate_session_locally: true,
      });

      const visitorData = ephemeralClient.session.context.client.visitorData;
      if (!visitorData) {
        console.warn('[poTokenService] Ephemeral client returned no visitorData');
        return {};
      }

      // 2. Set up DOM environment for BotGuard challenge execution
      const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        url: 'https://www.youtube.com',
        runScripts: 'dangerously',
      });

      // Safely preserve property descriptors to restore Node globals accurately
      const originalWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
      const originalDocumentDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');
      const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
      const originalHTMLElementDesc = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');

      let poToken: string | undefined;

      try {
        Object.defineProperty(globalThis, 'window', {
          value: dom.window,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, 'document', {
          value: dom.window.document,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, 'navigator', {
          value: dom.window.navigator,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(globalThis, 'HTMLElement', {
          value: dom.window.HTMLElement,
          configurable: true,
          writable: true,
        });

        const bgConfig = {
          fetch: (input: any, init?: any) => fetch(input, init),
          globalObj: globalThis as Record<string, any>,
          identifier: visitorData,
          requestKey: 'O43z0dpjhgX20SCx4KAo',
        };

        const bgChallenge = await BG.Challenge.create(bgConfig);
        if (!bgChallenge) {
          throw new Error('BotGuard Challenge.create returned empty response');
        }

        let interpreterJs =
          bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
        if (
          !interpreterJs &&
          bgChallenge.interpreterJavascript.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue
        ) {
          const scriptUrl =
            bgChallenge.interpreterJavascript.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
          const fullUrl = scriptUrl.startsWith('http') ? scriptUrl : `https:${scriptUrl}`;
          const res = await fetch(fullUrl);
          interpreterJs = await res.text();
        }

        if (interpreterJs) {
          new Function(interpreterJs)();
        }

        const tokenResult = await BG.PoToken.generate({
          program: bgChallenge.program,
          globalName: bgChallenge.globalName,
          bgConfig,
        });

        poToken = tokenResult?.poToken;
      } finally {
        // Restore globals safely without breaking Node
        if (originalWindowDesc) Object.defineProperty(globalThis, 'window', originalWindowDesc);
        else delete (globalThis as any).window;

        if (originalDocumentDesc) Object.defineProperty(globalThis, 'document', originalDocumentDesc);
        else delete (globalThis as any).document;

        if (originalNavigatorDesc) Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
        else delete (globalThis as any).navigator;

        if (originalHTMLElementDesc)
          Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElementDesc);
        else delete (globalThis as any).HTMLElement;
      }

      if (poToken) {
        console.log(`[poTokenService] Minted fresh PO Token for visitorData: ${visitorData.slice(0, 15)}...`);
        cachedPoToken = {
          visitorData,
          poToken,
          expiresAt: Date.now() + PO_TOKEN_TTL_MS,
        };
        return { visitorData, poToken };
      } else {
        console.warn('[poTokenService] BotGuard produced no poToken; falling back gracefully');
        return { visitorData };
      }
    } catch (err: any) {
      console.warn('[poTokenService] BotGuard challenge execution failed:', err.message || err);
      return {};
    } finally {
      poTokenPromise = null;
    }
  })();

  return poTokenPromise;
};
