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

    // 3. Call Groq API
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
            content: `You are a financial intent extractor. Extract the transaction amount, category, and a short description (item) from the user's input. Return ONLY a valid JSON object with the keys "amount" (number), "category" (string), and "item" (string, a brief description of what was bought). Do not include markdown blocks like \`\`\`json, explanation, or any other text.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', errorText);
      return NextResponse.json({ error: 'Failed to process AI request' }, { status: 502 });
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    // Parse the JSON string from Groq to ensure it is valid
    const extractedData = JSON.parse(content);

    // 4. Save to Database using the active session's user_id
    const savedRecord = await saveExpense(
      Number(extractedData.amount), 
      extractedData.category, 
      extractedData.item || 'Expense', // Fallback just in case
      user.id
    );

    // 5. Return extracted JSON & saved database record
    return NextResponse.json(savedRecord);

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
