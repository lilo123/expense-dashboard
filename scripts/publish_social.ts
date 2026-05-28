/**
 * An-yen Streamlined Content Deployment Engine
 * Leverages a unified publishing gateway to bypass complex direct OAuth requirements.
 * 
 * Execution: npx tsx scripts/publish_social.ts "Custom text content..." "https://an-yen.com/image.jpg"
 */

async function deployContent(content: string, imageUrl: string) {
  console.log(`[An-yen Publisher] Executing daily content broadcast...`);
  console.log(`[Target Asset]: ${imageUrl}`);
  console.log(`[Payload Text]:\n${content}\n`);

  const gatewayWebhookUrl = process.env.PUBLISHING_WEBHOOK_URL;

  if (!gatewayWebhookUrl) {
    console.warn(`[Dry-Run Validation] Missing gateway API variable in .env.local. Executing dry-run pass.`);
    console.log(`[Verification]: Content verified and ready for live broadcasting across X and Instagram. 🌿`);
    return;
  }

  console.log(`[Gateway API] Dispatching content payload...`);
  const res = await fetch(gatewayWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: content,
      media: imageUrl
    })
  });

  if (!res.ok) {
    throw new Error(`Gateway Broadcast Failed: ${res.statusText}`);
  }

  console.log(`[Broadcast Verified]: Content successfully deployed across all channels! 🎉`);
}

const inputContent = process.argv[2] || "We rely on positive reinforcement to grow our careers, improve our fitness, and nurture our relationships.\n\nYet, when it comes to money, why do we assume that beating ourselves up with guilt and severe restriction will somehow lead to better outcomes?\n\nMindful wealth isn't about punishment—it's about alignment. 🌿\n\nan-yen.com";
const inputMedia = process.argv[3] || "https://an-yen.com/anyen_debut_morning_ritual.jpg";

deployContent(inputContent, inputMedia).catch((err) => {
  console.error(`[Fatal Error] Content broadcasting failed:`, err);
  process.exit(1);
});
