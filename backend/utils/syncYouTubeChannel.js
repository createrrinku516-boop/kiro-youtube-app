const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const dbFirestore = require('./dbFirestore');
const groqClient = require('./groqClient');

const YOUTUBE_CHANNEL_URL = process.env.YOUTUBE_CHANNEL_URL || 'https://www.youtube.com/@biker-stunds/shorts';

/**
 * Syncs videos from the specified YouTube channel.
 * Will not call process.exit() if imported, but will if run directly.
 */
const syncChannel = async (channelUrl = YOUTUBE_CHANNEL_URL) => {
    console.log(`[YouTube Sync] Starting sync for channel: ${channelUrl}`);
    
    // Find path to yt-dlp binary
    const ytdlpPath = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    
    if (!fs.existsSync(ytdlpPath)) {
        const errMsg = `[YouTube Sync] yt-dlp.exe binary not found at ${ytdlpPath}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    // Dump json from channel. Limit to latest 15 to keep sync fast and save API quota. Force IPv4 to avoid DNS resolution issues.
    const cmd = `"${ytdlpPath}" --force-ipv4 --dump-json --flat-playlist --playlist-end 15 --no-warnings ${channelUrl}`;
    
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, async (error, stdout, stderr) => {
            if (error) {
                console.error(`[YouTube Sync] exec error: ${error.message}`);
                return reject(error);
            }
            
            const lines = stdout.trim().split('\n');
            console.log(`[YouTube Sync] Found ${lines.length} videos on channel feed. Processing...`);
            
            let addedCount = 0;
            let skippedCount = 0;
            
            for (const line of lines) {
                if (!line) continue;
                try {
                    const videoData = JSON.parse(line);
                    const ytId = videoData.id || videoData.url;
                    if (!ytId) continue;

                    const existing = await dbFirestore.getVideoById(ytId);
                    if (existing) {
                        skippedCount++;
                        continue;
                    }
                    
                    const durSec = videoData.duration || 0;
                    const minutes = Math.floor(durSec / 60);
                    const seconds = Math.floor(durSec % 60);
                    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                    const isShort = true; // Assumed shorts since syncing shorts channel
                    
                    let bestThumbnail = '';
                    if (videoData.thumbnails && videoData.thumbnails.length > 0) {
                        bestThumbnail = videoData.thumbnails[videoData.thumbnails.length - 1].url;
                    } else if (videoData.thumbnail) {
                        bestThumbnail = videoData.thumbnail;
                    }

                    // Enrich metadata using Groq AI
                    console.log(`[YouTube Sync] Using AI Brain to enrich metadata for video: "${videoData.title}"...`);
                    const enriched = await groqClient.generateVideoMetadata(
                        videoData.title,
                        videoData.description || 'Watch this amazing YouTube Shorts video!'
                    ).catch(err => {
                        console.warn(`[YouTube Sync] AI enrichment failed for ${ytId}, using defaults.`, err.message);
                        return null;
                    });

                    const finalDescription = enriched ? enriched.description : (videoData.description || '');
                    const finalCategory = enriched ? enriched.category : 'Gaming';
                    const finalTags = enriched ? enriched.tags : ['imported', 'youtube'];
                    
                    const newVideo = {
                        id: ytId,
                        youtube_id: ytId,
                        title: videoData.title || 'Unknown Title',
                        description: finalDescription,
                        category: finalCategory,
                        tags: finalTags,
                        visibility: 'public',
                        uploader: {
                            id: videoData.uploader_id || '@biker-stunds',
                            username: videoData.uploader || 'biker_stunds',
                            channelName: videoData.uploader || 'Biker Stunds',
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(videoData.uploader || 'Biker Stunds')}&background=ff0000&color=fff`
                        },
                        views: videoData.view_count || 0,
                        likes: videoData.like_count || 0,
                        dislikes: 0,
                        duration: formattedDuration,
                        isShort: isShort,
                        thumbnail: bestThumbnail,
                        videoUrl: `https://kiro-youtube-app.vercel.app/api/videos/stream/${ytId}`,
                        storageLocation: 'YouTube',
                        status: 'Live',
                        createdAt: new Date().toISOString()
                    };
                    
                    await dbFirestore.createVideo(ytId, newVideo);
                    console.log(`[YouTube Sync] ✅ Synced & AI-Enriched: "${newVideo.title}" [${ytId}]`);
                    addedCount++;
                    
                } catch (err) {
                    console.error(`[YouTube Sync] Error processing a video:`, err.message);
                }
            }
            
            console.log(`[YouTube Sync] 🎉 Sync Complete! Added ${addedCount} new, skipped ${skippedCount} existing.`);
            resolve({ addedCount, skippedCount });
        });
    });
};

// Check if run directly from CLI
if (require.main === module) {
    syncChannel()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[YouTube Sync] CLI Execution failed:', err);
            process.exit(1);
        });
}

module.exports = {
    syncChannel
};
