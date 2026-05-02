import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface ExtractedExpense {
  amount: number;
  category: string;
  description: string;
  type: 'expense' | 'income';
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized access. Please log in.' }, { status: 401 })
    }

    const body = await req.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'A valid message string is required.' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      console.error('GROQ_API_KEY is missing.')
      return NextResponse.json({ error: 'Internal Server Error: AI configuration missing.' }, { status: 500 })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `You are a financial assistant. Extract the financial transaction details from the user's message.\n            Respond strictly with a JSON object containing:\n            - amount: number (positive value)\n            - category: string\n            - description: string\n            - type: "expense" or "income"\n            Do not include any formatting, markdown, or text. Just the JSON object.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Groq API Error:', errorData)
      return NextResponse.json({ error: 'Failed to process message with AI provider.' }, { status: 502 })
    }

    const data = await response.json()
    const aiMessage = data.choices[0]?.message?.content

    if (!aiMessage) {
      return NextResponse.json({ error: 'Received an empty response from AI.' }, { status: 500 })
    }

    let parsedData: ExtractedExpense
    try {
      parsedData = JSON.parse(aiMessage)
    } catch (e) {
      console.error('Failed to parse AI response:', aiMessage)
      return NextResponse.json({ error: 'AI produced an invalid data format.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: parsedData })

  } catch (error) {
    console.error('BFF Chat Error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 }
    )
  }
}
