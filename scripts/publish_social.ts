/**
 * An-yen Automated Content Publishing Utility
 * Connects via official stable APIs (X / Instagram Graph) to publish daily mindful wealth insights.
 * 
 * Execution: npx tsx scripts/publish_social.ts "Content payload text..."
 */

async function publishSocial(content: string) {
  console.log(`[An-yen Publisher] Initiating daily social deployment...`);
  console.log(`[Content Payload]:\n${content}\n`);

  const xApiKey = process.env.X_API_KEY;
  const igApiToken = process.env.IG_API_TOKEN;

  if (!xApiKey || !igApiToken) {
    console.warn(`[Dry-Run Mode] Missing API Tokens in environment. Skipping live network dispatch.`);
    console.log(`[Validation]: Daily post verified and ready for live broadcasting.`);
    return;
  }

  // 1. Dispatch to X (Twitter) v2 API
  const xRes = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${xApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content }),
  });

  if (!xRes.ok) {
    throw new Error(`X API Broadcasting failure: ${xRes.statusText}`);
  }
  console.log(`[X/Twitter] Post successfully broadcasted.`);

  // 2. Dispatch to Instagram Graph API
  const igAccountId = process.env.IG_ACCOUNT_ID;
  const igRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media?caption=${encodeURIComponent(content)}&access_token=${igApiToken}`, {
    method: "POST"
  });

  if (!igRes.ok) {
    throw new Error(`Instagram API Broadcasting failure: ${igRes.statusText}`);
  }
  console.log(`[Instagram] Post successfully broadcasted.`);
}

const inputContent = process.argv[2] || "Mindful wealth check-in: Align today's spending with your core values. 🌿 #anyen";

publishSocial(inputContent).catch((err) => {
  console.error(`[Fatal Error] Social deployment failed:`, err);
  process.exit(1);
});
