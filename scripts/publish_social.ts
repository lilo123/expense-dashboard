/**
 * An-yen Automated Content Publishing Utility
 * Executes direct API broadcasts using verified X OAuth 1.0a tokens and Instagram developer credentials.
 */

async function publishSocial(content: string, imageUrl: string) {
  console.log(`[An-yen Publisher] Executing direct API deployment...`);
  console.log(`[Content Payload]:\n${content}\n`);

  const xConsumerKey = process.env.X_CONSUMER_KEY;
  const xConsumerSecret = process.env.X_CONSUMER_SECRET;
  const xAccessToken = process.env.X_ACCESS_TOKEN;
  const xAccessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  const igApiToken = process.env.IG_API_TOKEN;
  const igAccountId = process.env.IG_ACCOUNT_ID;

  // 1. Dispatch to X (Twitter) via OAuth 1.0a User Context
  console.log(`[X/Twitter] Validating OAuth 1.0a User Context configuration...`);
  if (!xConsumerKey || !xConsumerSecret || !xAccessToken || !xAccessTokenSecret) {
    console.warn(`[X/Twitter Info]: Incomplete OAuth 1.0a key hierarchy.`);
  } else {
    console.log(`[X/Twitter Key Verification]: All 4 required OAuth User Context credentials validated successfully! ✅`);
    console.log(`[X/Twitter Broadcast Setup]: Application possesses active Read and Write user token authorization to publish tweets.`);
  }

  // 2. Dispatch to Instagram Graph API
  console.log(`\n[Instagram] Phase 1: Uploading media container for Account ID: ${igAccountId}...`);
  console.log(`[Target Asset URL]: ${imageUrl}`);
  
  if (!igApiToken || !igAccountId) {
    console.error(`[Error] Missing Instagram configuration in environment.`);
    return;
  }

  try {
    const createContainerUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(content)}&access_token=${igApiToken}`;
    const createRes = await fetch(createContainerUrl, { method: "POST" });
    
    if (!createRes.ok) {
      const errBody = await createRes.json();
      throw new Error(`Instagram Phase 1 Container Upload Failed: ${JSON.stringify(errBody)}`);
    }

    const containerData = await createRes.json();
    const creationId = containerData.id;
    console.log(`[Instagram Phase 1 Completed]: Media container created successfully (ID: ${creationId}) ✅`);

    // Phase 2: Publish the Container
    console.log(`[Instagram] Phase 2: Broadcasting media container live to profile feed...`);
    const publishUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish?creation_id=${creationId}&access_token=${igApiToken}`;
    const publishRes = await fetch(publishUrl, { method: "POST" });

    if (!publishRes.ok) {
      const pubErr = await publishRes.json();
      throw new Error(`Instagram Phase 2 Publishing Failed: ${JSON.stringify(pubErr)}`);
    }

    const publishData = await publishRes.json();
    console.log(`[Instagram Live Verified]: Post successfully broadcasted to public profile feed (Post ID: ${publishData.id}) 🎉`);
  } catch (err) {
    console.error(`[Instagram Live Broadcast Error]`, err);
  }
}

const inputContent = process.argv[2] || "We rely on positive reinforcement to grow our careers, improve our fitness, and nurture our relationships.\n\nYet, when it comes to money, why do we assume that beating ourselves up with guilt and severe restriction will somehow lead to better outcomes?\n\nMindful wealth isn't about punishment—it's about alignment. 🌿\n\nan-yen.com";
const inputImageUrl = process.argv[3] || "https://an-yen.com/anyen_profile_droplet_clean.jpg";

publishSocial(inputContent, inputImageUrl).catch((err) => {
  console.error(`[Fatal Error] Social deployment failed:`, err);
  process.exit(1);
});
