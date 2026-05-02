import os
import re

with open('index.html', 'r') as f:
    html = f.read()

if 'chat-modal' not in html:
    chat_html = '''
    <!-- CHAT MODAL -->
    <div id="chat-modal" class="modal">
        <div class="modal-content chat-modal-content">
            <div class="chat-header">
                <h2>✨ AI Expense Assistant</h2>
            </div>
            <div id="chat-history" class="chat-history">
                <div class="chat-message ai-message">Hi! I can help you add, delete, or summarize expenses. How can I help today?</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="e.g., I spent $15 on coffee..." onkeypress="handleChatKeyPress(event)">
                <button id="send-chat-btn" onclick="sendChatMessage()">Send</button>
            </div>
        </div>
    </div>
'''
    html = html.replace('</body>', chat_html + '</body>')

if 'toggleChatModal()' not in html:
    html = re.sub(
        r'<div class="fab-container">.*?</div>',
        '<div class="fab-container">\n        <button class="fab secondary-fab" onclick="toggleChatModal()">✨</button>\n        <button id="fab" class="fab" onclick="toggleAddModal()">+</button>\n    </div>',
        html,
        flags=re.DOTALL
    )

with open('index.html', 'w') as f:
    f.write(html)

with open('styles.css', 'a') as f:
    f.write('''
/* CHAT UI */
.fab-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.secondary-fab {
    background-color: #666;
    font-size: 20px;
    width: 50px;
    height: 50px;
}
.chat-modal-content {
    display: flex;
    flex-direction: column;
    height: 60vh;
    padding: 0;
    overflow: hidden;
}
.chat-header {
    background-color: #000;
    color: #fff;
    padding: 15px;
    text-align: center;
}
.chat-header h2 {
    margin: 0;
    font-size: 1.2rem;
}
.chat-history {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background-color: #f9f9f9;
}
.chat-message {
    max-width: 80%;
    padding: 10px 15px;
    border-radius: 15px;
    font-size: 0.9rem;
    line-height: 1.4;
}
.ai-message {
    background-color: #e5e5ea;
    color: #000;
    align-self: flex-start;
    border-bottom-left-radius: 2px;
}
.user-message {
    background-color: #000;
    color: #fff;
    align-self: flex-end;
    border-bottom-right-radius: 2px;
}
.chat-input-area {
    display: flex;
    padding: 10px;
    border-top: 1px solid #ddd;
    background-color: #fff;
}
.chat-input-area input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 20px;
    outline: none;
    margin-right: 10px;
}
.chat-input-area button {
    background-color: #000;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    cursor: pointer;
}
''')
