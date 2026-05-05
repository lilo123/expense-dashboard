with open('src/components/ChatBox.tsx', 'r') as f:
    c = f.read()
c = c.replace("background: 'transparent', border: '1px solid var(--border)', padding: '12px 16px'", "background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '12px 16px'")
c = c.replace("padding: '15px', background: 'transparent', borderTop", "padding: '15px', background: 'var(--card-bg)', borderTop")
with open('src/components/ChatBox.tsx', 'w') as f:
    f.write(c)
