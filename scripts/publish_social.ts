/**
 * An-yen Automated Content Publishing Utility
 * Executes direct API broadcasts using verified X and Instagram developer tokens.
 */

async function publishSocial(content: string, imageUrl: string) {
  console.log(`[An-yen Publisher] Executing direct API deployment...`);
  console.log(`[Content Payload]:\n${content}\n`);

  const xApiKey = process.env.X_API_KEY;
  const igApiToken = process.env.IG_API_TOKEN;
  const igAccountId = process.env.IG_ACCOUNT_ID;

  if (!igApiToken || !igAccountId) {
    console.error(`[Error] Missing Instagram configuration in environment.`);
    process.exit(1);
  }

  // 1. Dispatch to Instagram Graph API (2-Step Media Container Flow)
  console.log(`[Instagram] Phase 1: Uploading media container for Account ID: ${igAccountId}...`);
  console.log(`[Target Asset URL]: ${imageUrl}`);
  
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

  // 2. Dispatch to X (Twitter)
  console.log(`\n[X/Twitter] Dispatching text to POST /tweets...`);
  if (!xApiKey) {
    console.warn(`[X/Twitter]: Skipping broadcast due to absent token.`);
    return;
  }

  try {
    const xRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${xApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    if (!xRes.ok) {
      console.warn(`[X/Twitter Broadcast Error]: ${xRes.status} ${xRes.statusText} (Note: X requires User Context OAuth tokens for POST tweet capability)`);
    } else {
      console.log(`[X/Twitter Live Verified]: Post successfully broadcasted to timeline 🎉`);
    }
  } catch (err) {
    console.error(`[X/Twitter Broadcast Error]`, err);
  }
}

const inputContent = process.argv[2] || "We rely on positive reinforcement to grow our careers, improve our fitness, and nurture our relationships.\n\nYet, when it comes to money, why do we assume that beating ourselves up with guilt and severe restriction will somehow lead to better outcomes?\n\nMindful wealth isn't about punishment—it's about alignment. 🌿\n\nan-yen.com";
const inputImageUrl = process.argv[3] || "https://an-yen.com/anyen_debut_morning_ritual.jpg";

publishSocial(inputContent, inputImageUrl).catch((err) => {
  console.error(`[Fatal Error] Social deployment failed:`, err);
  process.exit(1);
});
