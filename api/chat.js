export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { message, expenses } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing GROQ_API_KEY environment variable' });

  let expensesContext = "Here is the user's current expense data:\n";
  if (!expenses || expenses.length === 0) {
    expensesContext += "No expenses logged yet.\n";
  } else {
    expenses.forEach(exp => {
      expensesContext += `- Date: ${exp.date}, Amount: $${exp.amount}, Category: ${exp.category}, Description: ${exp.item}\n`;
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const systemPrompt = `You are a helpful financial assistant managing an expense tracker. Today\'s date is ${today}.
${expensesContext}

When the user asks about their expenses, use the data provided to summarize, calculate totals, or answer accurately. If they want to add an expense, reply with a JSON object like {"action": "add", "amount": 10, "category": "Dining Out", "description": "Pizza", "date": "${today}"}. Extract the date from their message if they mention one (e.g. yesterday, last Friday, Sep 12) formatted as YYYY-MM-DD, otherwise default to ${today}. If they are just asking a question, reply with {"action": "reply", "message": "your answer here"}. Always return valid JSON only. Categories must be one of: Housing, Utilities, Insurance, Groceries, Dining Out, Transportation, Household, Health & Care, Subscriptions, Shopping, Entertainment, Travel, Gifts, Education, Misc.`;;

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ],
    temperature: 0.2
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    
    if (!response.ok) return res.status(response.status).json({ error: data });

    const aiContent = data.choices[0].message.content.trim();
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiContent);
    } catch (e) {
      parsedResponse = { action: 'reply', message: aiContent };
    }
    return res.status(200).json({ success: true, data: parsedResponse });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
