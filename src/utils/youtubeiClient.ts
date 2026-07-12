// @ts-nocheck
/**
 * YouTubei.js Client-Side Integration
 * 
 * Uses the youtubei.js browser bundle to call YouTube's InnerTube API
 * through our CORS proxy (since direct browser fetch is blocked by CORS).
 * 
 * The decipher functions run 100% in the browser - no server-side streaming needed.
 */

const PROXY_BASE = (typeof window !== 'undefined' && window.location?.hostname)
  ? `http://${window.location.hostname}:5000/api`
  : 'http://localhost:5000/api';

const YT_PROXY = `${PROXY_BASE}/videos/proxy/cors?url=`;

// Create a proxied fetch that routes YouTube requests through our CORS proxy
function createProxiedFetch(apiBase: string) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Proxy YouTube requests through our CORS proxy
    if (url.includes('youtube.com') || url.includes('googlevideo.com')) {
      const proxyUrl = `${apiBase}/videos/proxy/cors?url=${encodeURIComponent(url)}&_t=${Date.now()}`;
      return fetch(proxyUrl, init);
    }
    
    // Other requests go through normally
    return fetch(input, init);
  };
}

let ytInstance: any = null;
let ytInstanceCreatedAt = 0;
const YT_INSTANCE_TTL = 30 * 60 * 1000; // 30 minutes

export async function createYtInstance(apiBase: string) {
  const now = Date.now();
  if (ytInstance && (now - ytInstanceCreatedAt < YT_INSTANCE_TTL)) {
    return ytInstance;
  }
  
  try {
    const { Innertube, Platform } = await import('youtubei.js/bundle/browser.js');
    
    // Override the eval to use Node.js Function() instead of browser eval
    Platform.shim.eval = async (data: any) => {
      const script = `
        var recsCache = new Map ? new Map() : {};
        var ntc = typeof Map !== 'undefined' ? new Map() : {};
        ${data.output}
      `;
      try {
        // eslint-disable-next-line no-new-func
        return new Function(script)();
      } catch (e) {
        console.error('[YouTubei] eval failed:', e);
        throw e;
      }
    };
    
    // Override fetch to use our proxy
    Platform.shim.fetch = createProxiedFetch(apiBase);
    
    const instance = await Innertube.create({
      generate_session_locally: true,
      retrieve_player: true
    });
    
    ytInstance = instance;
    ytInstanceCreatedAt = now;
    console.log('[YouTubei Client] Instance created successfully, player URL:', instance?.session?.player?.url);
    return instance;
  } catch (e: any) {
    console.error('[YouTubei Client] Failed to create instance:', e.message);
    throw e;
  }
}

export async function getStreamingData(videoId: string, apiBase: string) {
  try {
    const yt = await createYtInstance(apiBase);
    if (!yt) throw new Error('No yt instance');
    
    const info = await yt.getBasicInfo(videoId);
    const streamingData = info.streaming_data;
    
    if (!streamingData) throw new Error('No streaming data');
    
    const adaptiveFormats = streamingData.adaptive_formats || [];
    const formats = streamingData.formats || [];
    
    console.log(`[YouTubei Client] Got ${formats.length} formats + ${adaptiveFormats.length} adaptive for ${videoId}`);
    
    // Check if we have cipher data
    const hasCipher = adaptiveFormats.some((f: any) => f.url || f.signature_cipher || f.cipher);
    if (!hasCipher) {
      throw new Error('No URL/cipher data in formats (bot detection?). Need a valid PO token.');
    }
    
    // Decipher all formats using youtubei.js's built-in decipher
    const decipheredFormats: Array<{
      url: string;
      mimeType: string;
      itag: number;
      height?: number;
      width?: number;
      hasAudio: boolean;
      hasVideo: boolean;
    }> = [];
    
    for (const fmt of [...formats, ...adaptiveFormats]) {
      try {
        const url = await fmt.decipher(yt.session.player);
        if (url) {
          decipheredFormats.push({
            url,
            mimeType: fmt.mime_type,
            itag: fmt.itag,
            height: fmt.height,
            width: fmt.width,
            hasAudio: !!fmt.has_audio,
            hasVideo: !!fmt.has_video
          });
        }
      } catch (e: any) {
        // Skip this format
      }
    }
    
    console.log(`[YouTubei Client] Deciphered ${decipheredFormats.length} URLs`);
    return decipheredFormats;
  } catch (e: any) {
    console.error('[YouTubei Client] getStreamingData failed:', e.message);
    throw e;
  }
}
