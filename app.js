const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby7WHdT8KRVWFI2QCQzK3Us_YSm6gbf_2z4AoRMll5xkBJY5-Ro2yjLp7lJqwV8jeIX/exec";
const WEB_SECRET = "ExpenseDashboard741236";

document.addEventListener("DOMContentLoaded", fetchExpenses);

async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        
        if (result.success) {
            renderDashboard(result.data);
        } else {
            alert("Error loading data: " + result.error);
        }
    } catch (error) {
        console.error("Fetch error:", error);
        document.getElementById('loading').innerText = "Failed to load data.";
    }
}

function renderDashboard(data) {
    document.getElementById('loading').style.display = 'none';
    
    let total = 0;
    const categories = {};
    
    data.forEach(row => {
        const amount = Number(row.amount) || 0;
        total += amount;
        
        const cat = row.category || 'Other';
        if (!categories[cat]) categories[cat] = 0;
        categories[cat] += amount;
    });

    const statsContainer = document.getElementById('category-stats');
    statsContainer.innerHTML = '';
    
    Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, amount]) => {
            const box = document.createElement('div');
            box.className = 'stat-box';
            box.innerHTML = `
                <span class="stat-category">${cat}</span>
                <span class="stat-amount">$${amount.toFixed(2)}</span>
            `;
            statsContainer.appendChild(box);
        });

    document.getElementById('total-amount').innerText = `$${total.toFixed(2)}`;

    const tbody = document.getElementById('expense-list');
    tbody.innerHTML = '';

    const reversedData = data.map((row, index) => ({ ...row, originalIndex: index })).reverse();

    reversedData.forEach(row => {
        const li = document.createElement('li');
        li.className = 'swipe-item';
        
        const sheetRow = row.originalIndex + 2;

        li.innerHTML = `
            <div class="delete-btn" onclick="deleteExpense(${sheetRow}, this)">Delete</div>
            <div class="swipe-content" onmousedown="handleSwipeStart(event, this)" ontouchstart="handleSwipeStart(event, this)">
                <div class="expense-info">
                    <span class="expense-item-name">${row.item}</span>
                    <span class="expense-meta">${row.category} • ${formatDate(row.date)}</span>
                </div>
                <div class="expense-amount">$${Number(row.amount).toFixed(2)}</div>
            </div>
        `;
        tbody.appendChild(li);
    });
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
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'add',
                text: text,
                secret: WEB_SECRET
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            input.value = '';
            document.getElementById('loading').style.display = 'block';
            document.getElementById('expense-list').innerHTML = '';
            document.getElementById('category-stats').innerHTML = '';
            await fetchExpenses();
        } else {
            alert("Error: " + result.error);
        }
    } catch (error) {
        console.error("Add error:", error);
        alert("Failed to add expense.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Add";
    }
}

async function deleteExpense(rowNumber, btnElement) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    
    const li = btnElement.closest('.swipe-item');
    li.style.opacity = '0.5';

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'delete',
                row: rowNumber,
                secret: WEB_SECRET
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('loading').style.display = 'block';
            await fetchExpenses();
        } else {
            alert("Delete failed. Make sure your Apps Script supports deleting.");
            li.style.opacity = '1';
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete expense.");
        li.style.opacity = '1';
    }
}

let startX = 0;
let currentX = 0;
let swipingElement = null;

function handleSwipeStart(e, element) {
    startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    swipingElement = element;
    swipingElement.classList.add('swiping');
    
    document.addEventListener('mousemove', handleSwipeMove);
    document.addEventListener('touchmove', handleSwipeMove);
    document.addEventListener('mouseup', handleSwipeEnd);
    document.addEventListener('touchend', handleSwipeEnd);
}

function handleSwipeMove(e) {
    if (!swipingElement) return;
    const x = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    const diff = x - startX;
    
    if (diff > 0 && diff <= 100) {
        swipingElement.style.transform = `translateX(${diff}px)`;
        currentX = diff;
    }
}

function handleSwipeEnd(e) {
    if (!swipingElement) return;
    
    document.removeEventListener('mousemove', handleSwipeMove);
    document.removeEventListener('touchmove', handleSwipeMove);
    document.removeEventListener('mouseup', handleSwipeEnd);
    document.removeEventListener('touchend', handleSwipeEnd);
    
    swipingElement.classList.remove('swiping');
    
    if (currentX > 40) {
        swipingElement.style.transform = `translateX(80px)`;
    } else {
        swipingElement.style.transform = `translateX(0px)`;
    }
    
    swipingElement = null;
    currentX = 0;
}
