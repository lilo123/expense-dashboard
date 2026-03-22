const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby7WHdT8KRVWFI2QCQzK3Us_YSm6gbf_2z4AoRMll5xkBJY5-Ro2yjLp7lJqwV8jeIX/exec";
const WEB_SECRET = "ExpenseDashboard741236";

// Fetch data on load
document.addEventListener("DOMContentLoaded", fetchExpenses);

async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        
        if (result.success) {
            renderTable(result.data);
        } else {
            alert("Error loading data: " + result.error);
        }
    } catch (error) {
        console.error("Fetch error:", error);
        document.getElementById('loading').innerText = "Failed to load data.";
    }
}

function renderTable(data) {
    document.getElementById('loading').style.display = 'none';
    const table = document.getElementById('expense-table');
    const tbody = document.getElementById('expense-list');
    const totalEl = document.getElementById('total-amount');
    
    tbody.innerHTML = '';
    let total = 0;

    // Reverse to show newest first
    [...data].reverse().forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(row.date)}</td>
            <td>${row.item}</td>
            <td>${row.category}</td>
            <td>$${Number(row.amount).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
        total += Number(row.amount) || 0;
    });

    totalEl.innerText = `$${total.toFixed(2)}`;
    table.style.display = 'table';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

async function addExpense() {
    const input = document.getElementById('expense-input');
    const btn = document.getElementById('submit-btn');
    const text = input.value.trim();
    
    if (!text) return;

    btn.disabled = true;
    btn.innerText = "Adding...";

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            // Using text/plain to avoid CORS preflight issues with GAS
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                text: text,
                secret: WEB_SECRET
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            input.value = '';
            document.getElementById('loading').style.display = 'block';
            document.getElementById('expense-table').style.display = 'none';
            await fetchExpenses();
        } else {
            alert("Error: " + result.error);
        }
    } catch (error) {
        console.error("Add error:", error);
        alert("Failed to add expense.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Add Expense";
    }
}
