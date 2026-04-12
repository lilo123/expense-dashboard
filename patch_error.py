import os

# 1. Update api/chat.js
chat_path = 'api/chat.js'
if os.path.exists(chat_path):
    with open(chat_path, 'r') as f:
        content = f.read()
    content = content.replace(
        "if (!response.ok) return res.status(response.status).json({ error: data.error || 'Groq API error' });",
        "if (!response.ok) return res.status(response.status).json({ error: (data.error && data.error.error && data.error.error.message) ? data.error.error.message : (data.error && data.error.message) ? data.error.message : (data.error || 'Groq API error') });"
    )
    with open(chat_path, 'w') as f:
        f.write(content)

# 2. Update app.js
app_path = 'app.js'
if os.path.exists(app_path):
    with open(app_path, 'r') as f:
        content = f.read()
    content = content.replace(
        "if (data.error) throw new Error(data.error);",
        "if (data.error) throw new Error(typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : data.error);"
    )
    with open(app_path, 'w') as f:
        f.write(content)
print('Error handling patched')
