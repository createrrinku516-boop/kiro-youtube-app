// @ts-nocheck
import { Innertube, UniversalCache, Platform } from 'youtubei.js/web';

let ytInstance = null;

// Provide JS evaluator so youtubei.js can decipher URLs in the browser
Platform.shim.eval = async (data) => {
  // eslint-disable-next-line no-new-func
  return new Function(data.output)();
};

export const getAllDecryptedFormats = async (videoId, poToken, visitorData) => {
  try {
    if (!ytInstance || ytInstance.lastPoToken !== poToken) {
      console.log('[innertubeDecipher] Initializing youtubei.js/web in browser...');
      
      const config = {
        generate_session_locally: true,
        retrieve_player: true,
        cache: new UniversalCache(false),
        fetch: async (input, init) => {
          let url = '';
          if (typeof input === 'string') {
            url = input;
          } else if (input && input.url) {
            url = input.url;
          } else if (input && input.href) {
            url = input.href;
          } else {
            url = String(input);
          }
          
          const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
          const proxyUrl = `${apiBase}/videos/proxy/cors?url=${encodeURIComponent(url)}`;
          const newInit = { ...init };
          if (newInit.headers) {
            newInit.headers = new Headers(newInit.headers);
            newInit.headers.delete('user-agent');
            newInit.headers.delete('origin');
            newInit.headers.delete('referer');
          }
          return fetch(proxyUrl, newInit);
        }
      };

      if (poToken) config.po_token = poToken;
      if (visitorData) config.visitor_data = visitorData;

      ytInstance = await Innertube.create(config);
      ytInstance.lastPoToken = poToken;
    }

    const info = await ytInstance.getBasicInfo(videoId);
    const formats = info.streaming_data?.formats || [];
    const adaptiveFormats = info.streaming_data?.adaptive_formats || [];

    let fullQualityMap = {};
    let bestUrl = null;
    let bestQuality = null;
    let audioUrl = null;

    const processFormat = async (f, type) => {
      let url = f.url;
      if (!url && f.decipher) {
        url = await f.decipher(ytInstance.session.player);
      }
      if (url) {
        const nominalHeight = (f.width && f.height) ? Math.min(f.width, f.height) : (f.height || 0);
        const qualityLabel = nominalHeight ? `${nominalHeight}p` : 'auto';
        return { url, qualityLabel, nominalHeight, type };
      }
      return null;
    };

    // Process combined formats
    for (const f of formats) {
      const res = await processFormat(f, 'combined');
      if (res) {
        if (!bestUrl) {
          bestUrl = res.url;
          bestQuality = res.qualityLabel;
        }
        fullQualityMap[res.qualityLabel] = { url: res.url, type: 'combined' };
      }
    }

    // Process adaptive formats
    for (const f of adaptiveFormats) {
      const isVideo = f.mime_type && f.mime_type.startsWith('video/');
      const isAudio = f.mime_type && f.mime_type.startsWith('audio/');
      
      if (isVideo) {
        const res = await processFormat(f, 'video_only');
        if (res && (!fullQualityMap[res.qualityLabel] || fullQualityMap[res.qualityLabel].type !== 'combined')) {
          fullQualityMap[res.qualityLabel] = { url: res.url, type: 'video_only' };
        }
      } else if (isAudio && !audioUrl) {
        const res = await processFormat(f, 'audio_only');
        if (res) audioUrl = res.url;
      }
    }

    if (!bestUrl) {
      throw new Error('youtubei.js: no valid playable formats found');
    }

    return {
      bestUrl,
      bestQuality,
      audioUrl,
      fullQualityMap
    };
  } catch (err) {
    console.error('[innertubeDecipher] Failed to extract formats:', err);
    return null; // Return null so VideoPlayer can fallback to backend stream
  }
};
