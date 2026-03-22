const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby7WHdT8KRVWFI2QCQzK3Us_YSm6gbf_2z4AoRMll5xkBJY5-Ro2yjLp7lJqwV8jeIX/exec";
const WEB_SECRET = "ExpenseDashboard741236";

let expensesData = [];

document.addEventListener("DOMContentLoaded", fetchExpenses);

async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        
        if (result.success) {
            expensesData = result.data;
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
                <span class="stat-category">${escapeHtml(cat)}</span>
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
            <div class="swipe-content" 
                 onmousedown="handleSwipeStart(event, this)" 
                 ontouchstart="handleSwipeStart(event, this)"
                 data-row="${sheetRow}"
                 data-item="${escapeHtmlQuotes(row.item)}"
                 data-amount="${row.amount}"
                 data-category="${escapeHtmlQuotes(row.category)}"
                 data-date="${row.date}"
                 onclick="handleCardClick(this)">
                <div class="expense-info">
                    <span class="expense-item-name">${escapeHtml(row.item)}</span>
                    <span class="expense-meta">${escapeHtml(row.category)} • ${formatDate(row.date)}</span>
                </div>
                <div class="expense-amount">$${Number(row.amount).toFixed(2)}</div>
            </div>
        `;
        tbody.appendChild(li);
    });
}

function escapeHtml(unsafe) {
    return (unsafe || '').toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function escapeHtmlQuotes(str) {
    return (str || '').toString().replace(/"/g, '&quot;');
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
let isSwiping = false;

function handleSwipeStart(e, element) {
    startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    swipingElement = element;
    swipingElement.classList.add('swiping');
    isSwiping = false;
    currentX = 0;
    
    document.addEventListener('mousemove', handleSwipeMove);
    document.addEventListener('touchmove', handleSwipeMove);
    document.addEventListener('mouseup', handleSwipeEnd);
    document.addEventListener('touchend', handleSwipeEnd);
}

function handleSwipeMove(e) {
    if (!swipingElement) return;
    const x = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    const diff = x - startX;
    
    if (Math.abs(diff) > 5) {
        isSwiping = true;
    }
    
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
    
    setTimeout(() => {
        swipingElement = null;
        isSwiping = false;
    }, 50);
}

// === EDIT LOGIC ===

function handleCardClick(el) {
    if (isSwiping || currentX > 40) return;
    const row = el.getAttribute('data-row');
    const item = el.getAttribute('data-item');
    const amount = el.getAttribute('data-amount');
    const category = el.getAttribute('data-category');
    const date = el.getAttribute('data-date');
    openEditModal(row, item, amount, category, date);
}

function openEditModal(row, item, amount, category, date) {
    document.getElementById('edit-row').value = row;
    document.getElementById('edit-item').value = item;
    document.getElementById('edit-amount').value = amount;
    document.getElementById('edit-category').value = category;
    
    let formattedDate = "";
    if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
        }
    }
    document.getElementById('edit-date').value = formattedDate;
    
    document.getElementById('edit-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target == modal) {
        closeEditModal();
    }
}

async function saveEdit() {
    const row = document.getElementById('edit-row').value;
    const item = document.getElementById('edit-item').value.trim();
    const amount = document.getElementById('edit-amount').value;
    const category = document.getElementById('edit-category').value.trim();
    const date = document.getElementById('edit-date').value;
    
    if (!item || !amount || !category || !date) {
        alert("Please fill in all fields");
        return;
    }

    const btn = document.getElementById('save-edit-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'edit',
                row: row,
                item: item,
                amount: amount,
                category: category,
                date: date,
                secret: WEB_SECRET
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeEditModal();
            document.getElementById('loading').style.display = 'block';
            await fetchExpenses();
        } else {
            alert("Edit failed: " + result.error);
        }
    } catch (error) {
        console.error("Edit error:", error);
        alert("Failed to edit expense.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }
}
