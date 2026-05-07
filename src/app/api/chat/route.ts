import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { saveExpense } from '@/lib/expenses';

export async function POST(request: Request) {
  try {
    // 1. Verify Supabase Session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 3. Fetch user categories FIRST to provide as enum
    const { data: userCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id);

    const categoriesList = userCategories || [];
    const categoryNames = categoriesList.map((c: any) => c.name);

    if (categoryNames.length === 0) {
      return NextResponse.json({ error: 'No categories found for user. Please create a category first.' }, { status: 400 });
    }

    // 4. Call Groq API with Function Calling for Strict Outputs
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('GROQ_API_KEY is missing');
      return NextResponse.json({ error: 'Internal Server Configuration Error' }, { status: 500 });
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
            content: `You are a helpful financial assistant. Today's reference date is ${todayStr}. Help the user log their expenses into these categories: [${categoryNames.join(', ')}]. If you return JSON, it MUST be raw JSON without any markdown wrapping (do not use \`\`\`json or \`\`\`). Interpret bare numbers (without currency symbols like $) as currency. If the user is just chatting, saying hello, or expressing emotion, respond normally with a conversational message. DO NOT log an expense for casual chatter.`
          },
          {
            role: 'user',
            content: message
          }
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
                  category: { 
                    type: 'string', 
                    enum: categoryNames,
                    description: 'The category of the expense'
                  },
                  item: { type: 'string', description: 'A short description of the item or service' },
                  date: {
                    type: 'string',
                    description: "The date the expense occurred, strictly formatted as YYYY-MM-DD. You MUST mathematically calculate relative descriptors like 'yesterday' (today's reference date minus 1 day), '2 days ago' (today minus 2 days), or 'last Friday' relative to today's reference date and return the resolved date in YYYY-MM-DD format. Do NOT return relative words like 'yesterday' or 'today'—always return a YYYY-MM-DD string. If no date is mentioned, strictly return today's reference date."
                  }
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
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      return NextResponse.json({ error: 'Failed to process AI request' }, { status: 502 });
    }

    const data = await groqResponse.json();
    
    // Extract from tool call
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    let extractedData;
    
    const cleanJsonString = (str: string) => {
      return str.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
    };

    if (toolCalls && toolCalls.length > 0 && toolCalls[0].function.arguments) {
      try {
        const sanitizedArgs = cleanJsonString(toolCalls[0].function.arguments);
        extractedData = JSON.parse(sanitizedArgs);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid tool call response from AI' }, { status: 500 });
      }
    } else {
      // Fallback if the model somehow returned a standard JSON object message
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          const sanitizedContent = cleanJsonString(content);
          extractedData = JSON.parse(sanitizedContent);
        } catch(e) {
          return NextResponse.json({ reply: content });
        }
      } else {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
      }
    }

    // Extract properties case-insensitively just in case the LLM messes up
    const amount = extractedData.amount ?? extractedData.Amount;
    const categoryNameFromLLM = String(extractedData.category ?? extractedData.Category ?? '');
    const item = extractedData.item ?? extractedData.Item ?? 'Expense';
    let resolvedDate = extractedData.date ?? extractedData.Date ?? todayStr;
    
    // Programmatic failsafe in case the LLM returns the literal relative words
    const dateStrLower = String(resolvedDate).toLowerCase().trim();
    if (dateStrLower === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      resolvedDate = d.toISOString().split('T')[0];
    } else if (dateStrLower === 'today') {
      resolvedDate = todayStr;
    }
    
    const dateToInsert = new Date(resolvedDate).toISOString();

    // Validation check before DB insert
    if (!categoryNameFromLLM || amount === undefined || amount === null || isNaN(Number(amount))) {
      return NextResponse.json({ error: `I couldn't determine the category or amount from that message. Please try again.` }, { status: 400 });
    }

    // 5. Fallback Logic: Validate category against DB names
    let finalCategoryName = categoryNameFromLLM;
    const categoryStrLower = finalCategoryName.toLowerCase();
    
    let matchedCategory = categoriesList.find((c: any) => c.name.toLowerCase() === categoryStrLower);
    let category_id;

    if (matchedCategory) {
      category_id = matchedCategory.id;
      finalCategoryName = matchedCategory.name;
    } else {
      // LLM returned something outside the enum. Fallback to a generic category instead of failing or creating a new one.
      let genericCategory = categoriesList.find((c: any) => 
        c.name.toLowerCase() === 'misc' || 
        c.name.toLowerCase() === 'miscellaneous' || 
        c.name.toLowerCase() === 'other'
      );
      
      if (genericCategory) {
        category_id = genericCategory.id;
        finalCategoryName = genericCategory.name;
      } else {
        // Absolute fallback if 'Misc' or 'Other' does not exist: use the first available category
        category_id = categoriesList[0].id;
        finalCategoryName = categoriesList[0].name;
      }
    }

    // 6. Save to Database using the active session's user_id and resolved category_id
    // Using new Date().toISOString() ensures we store in UTC as mandated
    const savedRecord = await saveExpense(
      Number(amount), 
      category_id, 
      String(item),
      user.id,
      dateToInsert
    );
    
    const expenseData = Array.isArray(savedRecord) ? savedRecord[0] : savedRecord;

    // 7. Return extracted JSON & saved database record with dynamic reply
    return NextResponse.json({
      reply: `Got it! I've added $${Number(amount).toFixed(2)} for ${item} under ${finalCategoryName}.`,
      expense: expenseData || {
        id: Date.now().toString(),
        amount: Number(amount),
        category_id: category_id,
        categories: { name: finalCategoryName },
        item: String(item),
        date: dateToInsert
      }
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
