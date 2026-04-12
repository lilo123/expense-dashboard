import os

app_path = 'app.js'
with open(app_path, 'r') as f:
    content = f.read()

content = content.replace(
    "if (data.error) throw new Error(typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : data.error);",
    "if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));"
)
with open(app_path, 'w') as f:
    f.write(content)

api_path = 'api/chat.js'
with open(api_path, 'r') as f:
    content = f.read()

content = content.replace(
    "if (!response.ok) return res.status(response.status).json({ error: (data.error && data.error.error && data.error.error.message) ? data.error.error.message : (data.error && data.error.message) ? data.error.message : (data.error || 'Groq API error') });",
    "if (!response.ok) return res.status(response.status).json({ error: data });"
)
with open(api_path, 'w') as f:
    f.write(content)

print('patched')
