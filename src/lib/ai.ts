export async function extractExpenseFromMessage(
  message: string, 
  categoriesList: { id: string; name: string }[]
): Promise<{ amount: number; category_id: string; item: string; dateToInsert: string; finalCategoryName: string } | { error: string; status?: number }> {
  const todayStr = new Date().toISOString().split('T')[0];
  const categoryNames = categoriesList.map(c => c.name);
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    return { error: 'Internal Server Configuration Error', status: 500 };
  }

  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a helpful financial assistant. Today's reference date is ${todayStr}. Help the user log their expenses into these categories: [${categoryNames.join(', ')}]. If you return JSON, it MUST be raw JSON without any markdown wrapping. Interpret bare numbers as currency. DO NOT log an expense for casual chatter.`
        },
        { role: 'user', content: message }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_expense',
            description: 'Extract expense details from the user message',
            parameters: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'The numeric amount of the expense' },
                category: { type: 'string', enum: categoryNames, description: 'The category of the expense' },
                item: { type: 'string', description: 'A short description of the item' },
                date: { type: 'string', description: `Strictly formatted YYYY-MM-DD relative to ${todayStr}.` }
              },
              required: ['amount', 'category', 'item']
            }
          }
        }
      ],
      tool_choice: 'auto',
      temperature: 0
    })
  });

  if (!groqResponse.ok) {
    return { error: 'Failed to process AI request', status: 502 };
  }

  const data = await groqResponse.json();
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  let extractedData;

  const cleanJsonString = (str: string) => str.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();

  if (toolCalls && toolCalls.length > 0 && toolCalls[0].function.arguments) {
    try {
      extractedData = JSON.parse(cleanJsonString(toolCalls[0].function.arguments));
    } catch (e) {
      return { error: 'Invalid AI response', status: 500 };
    }
  } else {
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try { extractedData = JSON.parse(cleanJsonString(content)); } 
      catch (e) { return { error: content, status: 200 }; }
    } else {
      return { error: 'Empty response from AI', status: 500 };
    }
  }

  const amount = extractedData.amount ?? extractedData.Amount;
  const categoryNameFromLLM = String(extractedData.category ?? extractedData.Category ?? '');
  const item = extractedData.item ?? extractedData.Item ?? 'Expense';
  let resolvedDate = extractedData.date ?? extractedData.Date ?? todayStr;

  const dateStrLower = String(resolvedDate).toLowerCase().trim();
  if (dateStrLower === 'yesterday') {
    const d = new Date(); d.setDate(d.getDate() - 1); resolvedDate = d.toISOString().split('T')[0];
  } else if (dateStrLower === 'today') {
    resolvedDate = todayStr;
  }

  const dateToInsert = new Date(resolvedDate).toISOString();

  if (!categoryNameFromLLM || amount === undefined || amount === null || isNaN(Number(amount))) {
    return { error: `I couldn't determine the category or amount. Please try again.`, status: 400 };
  }

  let finalCategoryName = categoryNameFromLLM;
  let matchedCategory = categoriesList.find(c => c.name.toLowerCase() === finalCategoryName.toLowerCase());
  let category_id;

  if (matchedCategory) {
    category_id = matchedCategory.id;
    finalCategoryName = matchedCategory.name;
  } else {
    let genericCategory = categoriesList.find(c => ['misc', 'miscellaneous', 'other'].includes(c.name.toLowerCase()));
    if (genericCategory) {
      category_id = genericCategory.id; finalCategoryName = genericCategory.name;
    } else {
      category_id = categoriesList[0].id; finalCategoryName = categoriesList[0].name;
    }
  }

  return { amount: Number(amount), category_id, item: String(item), dateToInsert, finalCategoryName };
}
