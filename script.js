// --- CONFIGURATION ---
const WEB_APP_URL = "YOUR_WEB_APP_URL_HERE"; 
const WEB_SECRET = "YOUR_WEB_SECRET_HERE";

let expenseChartInstance = null;

document.addEventListener("DOMContentLoaded", fetchExpenses);

async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        if (result.success) renderChart(result.data);
    } catch (error) {
        console.error("Failed to fetch data.", error);
    }
}

function renderChart(data) {
    const categoryTotals = {};
    data.forEach(row => {
        const category = row.category || "Misc";
        const amount = parseFloat(String(row.amount).replace(/[^0-9.-]+/g,"")) || 0; 
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });

    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChartInstance) expenseChartInstance.destroy();

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#EA4335', '#34A853'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

function appendMessage(text, sender) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}

async function sendExpense() {
    const inputField = document.getElementById('expense-input');
    const text = inputField.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    inputField.value = '';
    const thinkingMsg = appendMessage("Thinking... 🤔", 'bot');

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ text: text, secret: WEB_SECRET })
        });
        const result = await response.json();
        thinkingMsg.remove();

        if (result.success) {
            const aiData = result.data;
            appendMessage(`✅ Logged $${aiData.amount} for ${aiData.item} under ${aiData.category}!`, 'bot');
            fetchExpenses(); 
        } else {
            appendMessage(`❌ Error: ${result.error}`, 'bot');
        }
    } catch (error) {
        thinkingMsg.remove();
        appendMessage(`❌ Network error. Check console.`, 'bot');
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') sendExpense();
}
