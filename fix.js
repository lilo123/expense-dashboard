const fs = require('fs');
const chatFile = 'src/app/api/chat/route.ts';
const siriFile = 'src/app/api/siri/route.ts';
let chatContent = fs.readFileSync(chatFile, 'utf8');
let siriContent = fs.readFileSync(siriFile, 'utf8');
const oldPrompt = "content: `You are a financial intent extractor. Extract the transaction amount, category, and a short description (item) from the user's input. You MUST map the expense to one of the provided categories: [${categoryNames.join(', ')}]. If the exact category isn\\'t clear, map it to the closest logical match or 'Misc'/'Other'.`";
const newPrompt = "content: `You are a helpful financial assistant. If the user mentions spending money, buying something, or an expense, use the 'extract_expense' tool to log it, mapping to categories: [${categoryNames.join(', ')}]. If the user is just chatting, saying hello, or expressing emotion, respond normally with a conversational message. DO NOT extract an expense for casual chatter.`";
chatContent = chatContent.replace(oldPrompt, newPrompt);
siriContent = siriContent.replace(oldPrompt, newPrompt);
const oldToolChoice = "tool_choice: { type: 'function', function: { name: 'extract_expense' } }";
const newToolChoice = "tool_choice: 'auto'";
chatContent = chatContent.replace(oldToolChoice, newToolChoice);
siriContent = siriContent.replace(oldToolChoice, newToolChoice);
const oldFallback = `      // Fallback if the model somehow returned a standard JSON object message
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          extractedData = JSON.parse(content);
        } catch(e) {
          return NextResponse.json({ error: 'Empty or invalid response from AI' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
      }`;
const newFallbackChat = `      // Fallback if the model somehow returned a standard JSON object message
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          extractedData = JSON.parse(content);
        } catch(e) {
          return NextResponse.json({ reply: content });
        }
      } else {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
      }`;
const newFallbackSiri = `      // Fallback if the model somehow returned a standard JSON object message
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          extractedData = JSON.parse(content);
        } catch(e) {
          return new NextResponse(content);
        }
      } else {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
      }`;
chatContent = chatContent.replace(oldFallback, newFallbackChat);
siriContent = siriContent.replace(oldFallback, newFallbackSiri);
fs.writeFileSync(chatFile, chatContent);
fs.writeFileSync(siriFile, siriContent);
