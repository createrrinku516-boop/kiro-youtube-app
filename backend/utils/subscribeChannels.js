const { subscribeChannel } = require('./youtubeWebhookAgent');

const CHANNELS = [
  'UCjvgGbPPn-FgYeguc5nxG4A',
  'UCjNgqJ_FMLntYVzq7daw1TQ',
  'UCKPDKDddJgtFoZz_XvqP1VQ',
  'UC-CSyyi47VX1lD9zyeABW3w',
  'UCX8pnu3DYUnx8qy8V_c6oHg',
  'UCebC4x5l2-PQxg46Ucv9CsA',
  'UCfLuT3JwLx8rvHjHfTymekw',
  'UCevMG6EtLoyazlMifbFTGTQ',
  'UCMrvxKTx9hLhZcOvJkYOnAw',
  'UCTig_sB8GjLOcTYBcw6700w'
];

/**
 * Iterates through all channels and renews/subscribes their WebSub subscriptions.
 */
const runSubscriptionLoop = async () => {
  console.log(`[Subscription Manager] Starting WebSub Hub subscriptions for ${CHANNELS.length} channels...`);
  
  for (const channelId of CHANNELS) {
    try {
      const success = await subscribeChannel(channelId);
      if (success) {
        console.log(`[Subscription Manager] ✅ Successfully submitted WebSub request for ${channelId}`);
      } else {
        console.warn(`[Subscription Manager] ❌ WebSub subscription failed for ${channelId}`);
      }
    } catch (err) {
      console.error(`[Subscription Manager] Error subscribing ${channelId}:`, err.message);
    }
    // Subtle delay to prevent rate-limiting at the Hub
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('[Subscription Manager] Completed subscription processing.');
};

// Execute if run directly from command line
if (require.main === module) {
  runSubscriptionLoop()
    .then(() => {
      console.log('[Subscription Manager] WebSub subscription run complete. Exiting.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Subscription Manager] Failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  CHANNELS,
  runSubscriptionLoop
};
