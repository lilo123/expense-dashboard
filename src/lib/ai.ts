import { CURRENCY_CONFIG } from './utils';

export async function extractExpenseFromMessage(
  message: string, 
  categoriesList: { id: string; name: string }[],
  baseCurrency: string = 'CAD',
  options?: { forceTool?: boolean; userTimezone?: string }
): Promise<{ 
  amount: number; 
  currency: string; 
  category_id: string; 
  item: string; 
  dateToInsert: string; 
  finalCategoryName: string; 
} | { error: string; status?: number }> {
  // Guard against empty categories
  if (!categoriesList || categoriesList.length === 0) {
    return { error: "No categories available to categorize this expense.", status: 400 };
  }

  let userTZ = options?.userTimezone || 'UTC';
  const now = new Date();
  
  // Try-catch timezone construction to handle invalid timezone strings gracefully
  const formatTZ = (dateObj: Date) => {
    let formatter;
    try {
      formatter = new Intl.DateTimeFormat('en-US', { 
        timeZone: userTZ, 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    } catch {
      userTZ = 'UTC';
      formatter = new Intl.DateTimeFormat('en-US', { 
        timeZone: 'UTC', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    }
    const parts = formatter.formatToParts(dateObj);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatTZ(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatTZ(yesterday);
  const categoryNames = categoriesList.map(c => c.name);
  const groqApiKey = process.env.GROQ_API_KEY;

  // Construct supportedCurrencies dynamically by combining CURRENCY_CONFIG keys with baseCurrency
  const configCurrencies = Object.keys(CURRENCY_CONFIG);
  const supportedCurrenciesSet = new Set([...configCurrencies, baseCurrency.toUpperCase()]);
  const supportedCurrencies = Array.from(supportedCurrenciesSet);

  if (!groqApiKey) {
    return { error: 'Internal Server Configuration Error', status: 500 };
  }

  const systemPrompt = `You are a helpful financial assistant. Today's reference date is ${todayStr}. 
User's baseline currency is ${baseCurrency}. 
Help the user log their expenses into these categories: [${categoryNames.join(', ')}]. 
You MUST call the 'extract_expense' function whenever the user message describes a purchase, transaction, or expense. 
Only output conversational text if the user is engaging in casual chatter or asking general budgeting questions. 
If you return JSON, it MUST be raw JSON without any markdown wrapping. Interpret bare numbers as currency.`;

  // 8-second timeout configuration using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let groqResponse: Response;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
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
                  currency: { 
                    type: 'string', 
                    enum: supportedCurrencies, 
                    description: `The ISO 3-letter currency code of the expense. Default strictly to the user's base currency (${baseCurrency}) if not explicitly specified or if ambiguous.` 
                  },
                  category: { type: 'string', enum: categoryNames, description: 'The category of the expense' },
                  item: { type: 'string', description: 'A short description of the item' },
                  date: { type: 'string', description: `Strictly formatted YYYY-MM-DD relative to ${todayStr}.` }
                },
                required: ['amount', 'currency', 'category', 'item']
              }
            }
          }
        ],
        tool_choice: options?.forceTool 
          ? { type: 'function', function: { name: 'extract_expense' } } 
          : 'auto',
        temperature: 0
      })
    });
  } catch (err: unknown) {
    const isAbort = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError');
    if (isAbort) {
      return { error: "AI processing timed out. Please try again.", status: 504 };
    }
    return { error: "Connection to AI service failed. Please check your connection and try again.", status: 503 };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!groqResponse.ok) {
    return { error: 'Failed to process AI request', status: 502 };
  }

  // Try-catch JSON response body downloads to prevent uncaught promise rejections
  let data;
  try {
    data = await groqResponse.json();
  } catch {
    return { error: 'Failed to parse AI response payload', status: 502 };
  }

  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  let extractedData;

  const cleanJsonString = (str: string) => str.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();

  if (toolCalls && toolCalls.length > 0 && toolCalls[0].function.arguments) {
    try {
      extractedData = JSON.parse(cleanJsonString(toolCalls[0].function.arguments));
    } catch {
      const rawArgs = toolCalls[0].function.arguments;
      // Intercept only if it actually starts like a JSON array or object, preventing chat false-positives
      if (/^\s*[\{\[]/.test(cleanJsonString(rawArgs))) {
        return { error: "I couldn't parse the transaction details. Please describe it again.", status: 400 };
      }
      return { error: 'Invalid AI response', status: 500 };
    }
  } else {
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try { 
        extractedData = JSON.parse(cleanJsonString(content)); 
      } catch { 
        // Intercept only if it actually starts like a JSON array or object, preventing conversational blocks
        if (/^\s*[\{\[]/.test(cleanJsonString(content))) {
          return { error: "I couldn't parse the transaction details. Please describe it again.", status: 400 };
        }
        return { error: content, status: 200 }; 
      }
    } else {
      return { error: 'Empty response from AI', status: 500 };
    }
  }

  // Defensive guard against JSON.parse("null") evaluation crash
  if (!extractedData || typeof extractedData !== 'object') {
    return { error: 'Invalid AI response formatting', status: 400 };
  }

  const amount = extractedData.amount ?? extractedData.Amount;
  let currencyFromLLM = String(extractedData.currency ?? extractedData.Currency ?? '').toUpperCase().trim();
  const categoryNameFromLLM = String(extractedData.category ?? extractedData.Category ?? '');
  const item = extractedData.item ?? extractedData.Item ?? 'Expense';
  let resolvedDate = extractedData.date ?? extractedData.Date ?? todayStr;

  const dateStrLower = String(resolvedDate).toLowerCase().trim();
  if (dateStrLower === 'yesterday') {
    resolvedDate = yesterdayStr;
  } else if (dateStrLower === 'today') {
    resolvedDate = todayStr;
  }

  // Default to local noon to prevent trans-meridian date shifts
  let dateToInsert = new Date(todayStr + "T12:00:00Z").toISOString();
  try {
    let targetDateStr = resolvedDate;
    // Pad successfully resolved date-only strings to prevent trans-meridian shifts
    if (/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
      targetDateStr = `${targetDateStr}T12:00:00Z`;
    }
    const parsedDate = new Date(targetDateStr);
    if (!isNaN(parsedDate.getTime())) {
      dateToInsert = parsedDate.toISOString();
    }
  } catch {
    // Silently default to local noon
  }

  if (!categoryNameFromLLM || amount === undefined || amount === null || isNaN(Number(amount))) {
    return { error: `I couldn't determine the category or amount. Please try again.`, status: 400 };
  }

  // Enforce default currency matching limits
  if (!currencyFromLLM || !supportedCurrencies.includes(currencyFromLLM)) {
    currencyFromLLM = baseCurrency.toUpperCase();
  }

  let finalCategoryName = categoryNameFromLLM;
  const matchedCategory = categoriesList.find(c => c.name.toLowerCase() === finalCategoryName.toLowerCase());
  let category_id;

  if (matchedCategory) {
    category_id = matchedCategory.id;
    finalCategoryName = matchedCategory.name;
  } else {
    const genericCategory = categoriesList.find(c => ['misc', 'miscellaneous', 'other'].includes(c.name.toLowerCase()));
    if (genericCategory) {
      category_id = genericCategory.id; 
      finalCategoryName = genericCategory.name;
    } else {
      // Instead of silently defaulting to categoriesList[0], return clean 400 error
      return { error: `I couldn't automatically match the category "${categoryNameFromLLM}" for your expense. Please specify a matching category or create one first.`, status: 400 };
    }
  }

  return { 
    amount: Number(amount), 
    currency: currencyFromLLM,
    category_id, 
    item: String(item), 
    dateToInsert, 
    finalCategoryName 
  };
}
