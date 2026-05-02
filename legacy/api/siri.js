export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Missing message body' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  // Fallbacks to support various Vercel environment variable naming conventions
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!groqApiKey || !supabaseUrl || !supabaseKey) {
     return res.status(500).json({ error: 'Missing server environment variables (Supabase or Groq).' });
  }

  // 1. Verify API Token
  const tokenRes = await fetch(`${supabaseUrl}/rest/v1/api_tokens?token=eq.${token}&select=user_id`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.length) {
    return res.status(401).json({ error: 'Invalid API Token: ' + token });
  }
  
  const userId = tokenData[0].user_id;

  // 2. Parse Message with AI
  const today = new Date().toISOString().split('T')[0];
  const systemPrompt = `You are a strict expense parsing assistant. Today is ${today}.
Extract the expense details from the user\'s message.
Respond ONLY with a JSON object in this exact format:
{"action": "add", "items": [{"amount": 10.50, "category": "Dining Out", "description": "Coffee", "date": "${today}"}]}

Categories must be one of: Housing, Utilities, Insurance, Groceries, Dining Out, Transportation, Household, Health & Care, Subscriptions, Shopping, Entertainment, Travel, Gifts, Education, Misc.`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.1
    })
  });

  const groqData = await groqRes.json();
  if (!groqRes.ok) return res.status(500).json({ error: 'AI Error', details: groqData });

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(groqData.choices[0].message.content.trim());
  } catch (e) {
    return res.status(400).json({ error: 'Failed to parse AI response' });
  }

  if (parsedResponse.action !== 'add' || !parsedResponse.items || !parsedResponse.items.length) {
    return res.status(400).json({ error: 'Could not detect an expense to add.' });
  }

  // 3. Insert into Supabase
  const insertPayload = parsedResponse.items.map(item => ({
    user_id: userId,
    date: item.date,
    item: item.description,
    amount: item.amount,
    category: item.category
  }));

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/expenses`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(insertPayload)
  });

  if (!insertRes.ok) {
    const errorData = await insertRes.json();
    return res.status(500).json({ error: 'Failed to save expense', details: errorData });
  }

  const addedItems = await insertRes.json();
  const summary = addedItems.map(i => `$${i.amount} for ${i.item}`).join(', ');

  return res.status(200).json({ 
    success: true, 
    message: `Added successfully: ${summary}` 
  });
}
