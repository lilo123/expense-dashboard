const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const oldAddModal = `<div id="add-modal" class="modal">
        <div class="modal-content">
            <span id="action-elem-9" class="close">&times;</span>
            <h2>Add Expense</h2>
            <input type="date" id="add-date" required>
            <input type="text" id="add-item" placeholder="What did you buy?" required>
            <input type="number" id="add-amount" placeholder="Amount ($)" step="0.01" required>
            <select id="add-category"></select>
            <button id="add-expense-btn">Add Expense</button>
        </div>
    </div>`;

const newAddModal = `<div id="add-modal" class="modal">
        <div class="modal-content" style="max-width: 400px; padding: 25px; border-radius: 12px;">
            <span id="action-elem-9" class="close" style="font-size: 24px;">&times;</span>
            <h2 style="margin-bottom: 20px; font-size: 1.5em; color: var(--text);">Add Expense</h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <input type="date" id="add-date" required style="padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 16px; width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text);">
                <input type="text" id="add-item" placeholder="What did you buy?" required style="padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 16px; width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text);">
                <div style="position: relative;">
                    <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">$</span>
                    <input type="number" id="add-amount" placeholder="0.00" step="0.01" required style="padding: 12px 12px 12px 25px; border-radius: 8px; border: 1px solid var(--border); font-size: 16px; width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text);">
                </div>
                <select id="add-category" style="padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 16px; width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text);"></select>
                <button id="add-expense-btn" style="padding: 14px; border-radius: 8px; font-weight: bold; background: var(--accent); color: white; border: none; cursor: pointer; margin-top: 5px; font-size: 16px; transition: opacity 0.2s;">Add Expense</button>
            </div>
        </div>
    </div>`;

html = html.replace(oldAddModal, newAddModal);

const oldChatModal = `<div id="chat-modal" class="modal">
        <div class="modal-content chat-modal-content">
            <div class="chat-header" style="display: flex; justify-content: space-between; align-items: center;">
                
                <h2 style="margin: 0; font-size: 1.2rem; text-align: left; flex: 1;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg> AI Assistant</h2>
                <span id="action-elem-13" class="close" style="color: white; cursor: pointer; font-size: 28px; line-height: 1;">&times;</span>
            </div>
            <div id="chat-history" class="chat-history">
                <div class="chat-message ai-message">Hi! I can help you add, delete, or summarize expenses. How can I help today?</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="e.g., I spent $15 on coffee...">
                <button id="send-chat-btn">&#10148;</button>
            </div>
        </div>
    </div>`;

const newChatModal = `<div id="chat-modal" class="modal">
        <div class="modal-content chat-modal-content" style="border-radius: 16px; overflow: hidden; padding: 0; display: flex; flex-direction: column; max-width: 450px; background: var(--card-bg); border: 1px solid var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div class="chat-header" style="display: flex; justify-content: space-between; align-items: center; background: var(--accent); color: white; padding: 15px 20px;">
                <h2 style="margin: 0; font-size: 1.2rem; text-align: left; flex: 1; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg> AI Assistant</h2>
                <span id="action-elem-13" class="close" style="color: white; cursor: pointer; font-size: 24px; line-height: 1; opacity: 0.8; transition: opacity 0.2s;">&times;</span>
            </div>
            <div id="chat-history" class="chat-history" style="flex: 1; padding: 20px; overflow-y: auto; background: var(--bg); display: flex; flex-direction: column; gap: 10px;">
                <div class="chat-message ai-message" style="background: var(--card-bg); border: 1px solid var(--border); padding: 12px 16px; border-radius: 12px; border-top-left-radius: 2px; align-self: flex-start; max-width: 85%; font-size: 15px; color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Hi! I can help you add, delete, or summarize expenses. How can I help today?</div>
            </div>
            <div class="chat-input-area" style="padding: 15px; background: var(--card-bg); border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: center;">
                <input type="text" id="chat-input" placeholder="e.g., I spent $15 on coffee..." style="flex: 1; padding: 12px 16px; border-radius: 24px; border: 1px solid var(--border); font-size: 15px; background: var(--bg); color: var(--text); outline: none;">
                <button id="send-chat-btn" style="background: var(--accent); color: white; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: transform 0.1s; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
            </div>
        </div>
    </div>`;

html = html.replace(oldChatModal, newChatModal);

fs.writeFileSync('index.html', html);
console.log("UX fixes applied");
