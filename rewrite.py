import os

filepath = 'src/app/api/chat/route.ts'
with open(filepath, 'r') as f:
    content = f.read()

content = content.replace(".split('T')[0]", "")

with open(filepath, 'w') as f:
    f.write(content)
print("Updated route.ts")
