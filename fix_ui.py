import re

with open('styles.css', 'r') as f:
    css = f.read()

css = css.replace('.secondary-fab {\n    background-color: #666;\n    font-size: 20px;\n    width: 50px;\n    height: 50px;\n}', '.secondary-fab {\n    background-color: #666;\n    font-size: 32px;\n    width: 60px;\n    height: 60px;\n}')

css = css.replace('.chat-input-area button {\n    background-color: #000;\n    color: #fff;\n    border: none;\n    padding: 10px 20px;\n    border-radius: 20px;\n    cursor: pointer;\n}', '.chat-input-area button {\n    background-color: #000;\n    color: #fff;\n    border: none;\n    width: 40px;\n    height: 40px;\n    border-radius: 50%;\n    cursor: pointer;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    font-size: 18px;\n    padding: 0;\n}')

with open('styles.css', 'w') as f:
    f.write(css)

with open('index.html', 'r') as f:
    html = f.read()

html = html.replace('<div class="chat-header">\n                <h2>✨ AI Expense Assistant</h2>\n            </div>', '<div class="chat-header" style="display: flex; justify-content: space-between; align-items: center;">\n                <div style="width: 24px;"></div>\n                <h2 style="margin: 0; font-size: 1.2rem;">✨ AI Assistant</h2>\n                <span class="close" onclick="toggleChatModal()" style="color: white; cursor: pointer; font-size: 28px; line-height: 1;">&times;</span>\n            </div>')

html = html.replace('<button id="send-chat-btn" onclick="sendChatMessage()">Send</button>', '<button id="send-chat-btn" onclick="sendChatMessage()">&#10148;</button>')

with open('index.html', 'w') as f:
    f.write(html)
