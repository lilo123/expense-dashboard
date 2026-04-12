export default async function handler(req, res) {
  // 1. Webhook Authentication
  const authHeader = req.headers.authorization;
  const SECRET_TOKEN = process.env.SIRI_SECRET_TOKEN;
  
  if (!SECRET_TOKEN || authHeader !== `Bearer ${SECRET_TOKEN}`) {
    // We return 200 with a message for Siri to speak if auth fails, rather than a raw 401
    return res.status(200).json({ message: "Unauthorized. Please check your secret token." });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ message: "Method Not Allowed" });
  }

  const { message } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://zjanajeevdvhbeuyflmg.supabase.co';
  // For backend insertion, we need either the service role key OR the anon key + user_id
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_alSzFV8OWSBkCnF8z5-0_Q_2MefRVwD';
  const siriUserId = process.env.SIRI_USER_ID;

  if (!message) {
    return res.status(200).json({ message: "What did you spend money on?" });
  }

  if (!siriUserId) {
    return res.status(200).json({ message: "Siri User ID is not set in your Vercel environment variables." });
  }

  const today = new Date().toISOString().split('T')[0];

  // 2. Define the Tool Schema (Native Function Calling)
  const tools = [
    {
      type: "function",
      function: {
        name: "add_expense",
        description: "Add an expense to the database. Use this when the user mentions spending money.",
        parameters: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "The cost of the expense (e.g., 15.50)"
            },
            item: {
              type: "string",
              description: "A short description of what was bought (e.g., 'Pizza', 'Gas')"
            },
            category: {
              type: "string",
              enum: ["Housing", "Utilities", "Insurance", "Groceries", "Dining Out", "Transportation", "Household", "Health & Care", "Subscriptions", "Shopping", "Entertainment", "Travel", "Gifts", "Education", "Misc"],
              description: "The category that best fits the expense."
            },
            date: {
              type: "string",
              description: `The date of the expense in YYYY-MM-DD format. Default to today (${today}) if not specified.`
            }
          },
          required: ["amount", "item", "category", "date"]
        }
      }
    }
  ];

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: `You are a helpful voice assistant. Today's date is ${today}. If the user provides an incomplete expense (e.g., missing the amount or what they bought), ask them for the missing information concisely. If they provide all details, call the add_expense function.` },
      { role: "user", content: message }
    ],
    tools: tools,
    tool_choice: "auto",
    temperature: 0.1
  };

  try {
    // 3. Call Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Groq Error:", data);
      return res.status(200).json({ message: "Sorry, I had trouble processing that with Groq." });
    }

    const aiMessage = data.choices[0].message;

    // Check if Groq decided to call a tool
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const toolCall = aiMessage.tool_calls[0];
      
      if (toolCall.function.name === "add_expense") {
        const args = JSON.parse(toolCall.function.arguments);
        
        // 4. Validate and Execute
        if (!args.amount || !args.item || !args.category) {
            return res.status(200).json({ message: "I'm missing some details. Could you repeat the expense with the amount and item?" });
        }

        // Insert into Supabase directly from the backend
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/expenses`, {
            method: "POST",
            headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                user_id: siriUserId,
                date: args.date || today,
                item: args.item,
                amount: args.amount,
                category: args.category
            })
        });

        if (!supabaseResponse.ok) {
            const sbError = await supabaseResponse.text();
            console.error("Supabase Error:", sbError);
            return res.status(200).json({ message: "I understood the expense, but failed to save it to the database." });
        }

        return res.status(200).json({ message: `Got it. I've added $${args.amount} for ${args.item} to ${args.category}.` });
      }
    } else {
      // 5. Multi-turn Clarification: If Groq didn't call a tool, it means it's asking for clarification
      return res.status(200).json({ message: aiMessage.content });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(200).json({ message: "I encountered a server error." });
  }
}
