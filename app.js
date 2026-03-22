const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyA4L51xcdLzRAeQQmr5rOluihTa11nxJhtI1v48ME3xpGUBOJxEfoEKh6J7PrOdgBP/exec";
const WEB_SECRET = "ExpenseDashboard741236";

let expenses = [];

document.addEventListener("DOMContentLoaded", () => {
    setDefaultDateRange();
    fetchExpenses();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`button[onclick*="${tabId}"]`).classList.add("active");
}

function setDefaultDateRange() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('start-date').value = firstDay.toISOString().split('T')[0];
    document.getElementById('end-date').value = today.toISOString().split('T')[0];
}

async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        
        if (result.success) {
            expenses = result.data.map((item, index) => ({...item, row: index + 2}));
            renderDashboard();
            renderRecent();
        } else {
            alert("Failed to load data.");
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function getFilteredExpenses() {
    const startStr = document.getElementById('start-date').value;
    const endStr = document.getElementById('end-date').value;
    
    if (!startStr && !endStr) return expenses;

    const start = startStr ? new Date(startStr) : new Date(0);
    const end = endStr ? new Date(endStr) : new Date();
    end.setHours(23, 59, 59, 999);

    return expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= start && expDate <= end;
    });
}

function applyDateFilter() {
    renderDashboard();
}

function clearDateFilter() {
    document.getElementById('start-date').value = "";
    document.getElementById('end-date').value = "";
    renderDashboard();
}

function renderDashboard() {
    const filtered = getFilteredExpenses();
    
    const total = filtered.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    document.getElementById('total-amount').innerText = `$${total.toFixed(2)}`;

    const byCategory = {};
    filtered.forEach(exp => {
        if (!byCategory[exp.category]) byCategory[exp.category] = { total: 0, items: [] };
        byCategory[exp.category].total += (parseFloat(exp.amount) || 0);
        byCategory[exp.category].items.push(exp);
    });

    const grid = document.getElementById('category-grid');
    grid.innerHTML = "";

    Object.keys(byCategory).sort((a,b) => byCategory[b].total - byCategory[a].total).forEach(cat => {
        const catData = byCategory[cat];
        
        const itemsHtml = catData.items.map(item => `
            <div class="category-detail-item" onclick="openEditModal(${item.row}, '${item.item.replace(/'/g, "\\'")}', ${item.amount}, '${item.category}', '${item.date}')">
                <span class="detail-date">${new Date(item.date).toLocaleDateString()}</span>
                <span class="detail-name">${item.item}</span>
                <span class="detail-amount">$${parseFloat(item.amount).toFixed(2)}</span>
            </div>
        `).join('');

        const cardHtml = `
            <div class="summary-card category-card" onclick="toggleCategoryDetails(this)">
                <div class="summary-card-header">
                    <h3>${cat}</h3>
                    <p>$${catData.total.toFixed(2)}</p>
                </div>
                <div class="category-details" style="display: none;">
                    ${itemsHtml}
                </div>
            </div>
        `;
        grid.innerHTML += cardHtml;
    });
}

function toggleCategoryDetails(element) {
    const details = element.querySelector('.category-details');
    if (details.style.display === 'none' || !details.style.display) {
        details.style.display = 'block';
    } else {
        details.style.display = 'none';
    }
}

function renderRecent() {
    const list = document.getElementById('recent-list');
    list.innerHTML = "";

    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(exp => {
        const d = new Date(exp.date);
        const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Unknown Date';
        const amt = parseFloat(exp.amount) || 0;

        list.innerHTML += `
            <div class="recent-card-wrapper">
                <div class="delete-btn" onclick="deleteExpense(${exp.row})">Delete</div>
                <div class="recent-card" 
                     data-row="${exp.row}"
                     data-item="${exp.item.replace(/"/g, '&quot;')}"
                     data-amount="${amt}"
                     data-category="${exp.category}"
                     data-date="${exp.date}"
                     onclick="handleCardClick(this)"
                     onmousedown="handleSwipeStart(event, this)"
                     ontouchstart="handleSwipeStart(event, this)">
                    <div class="recent-info">
                        <strong>${exp.item}</strong>
                        <span>${exp.category} &bull; ${dateStr}</span>
                    </div>
                    <div class="recent-amount">$${amt.toFixed(2)}</div>
                </div>
            </div>
        `;
    });
}

// === SWIPE TO DELETE LOGIC ===
let startX = 0;
let currentX = 0;
let swipingElement = null;
let isSwiping = false;

function handleSwipeStart(e, el) {
    swipingElement = el;
    startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    currentX = 0;
    isSwiping = false;
    
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
    
    if (Math.abs(diff) > 5) {
        isSwiping = true;
    }
    
    // Swipe left (negative diff)
    if (diff < 0 && diff >= -100) {
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
    
    // If swiped far enough left
    if (currentX < -40) {
        swipingElement.style.transform = `translateX(-80px)`;
    } else {
        swipingElement.style.transform = `translateX(0px)`;
    }
    
    setTimeout(() => {
        swipingElement = null;
        isSwiping = false;
    }, 50);
}

async function deleteExpense(row) {
    if (!confirm("Are you sure you want to delete this expense?")) {
        renderRecent();
        return;
    }
    
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'delete',
                row: row,
                secret: WEB_SECRET
            })
        });
        const result = await response.json();
        if (result.success) {
            await fetchExpenses();
        } else {
            alert("Delete failed: " + result.error);
        }
    } catch (e) {
        console.error(e);
        alert("Delete failed");
    }
}

// === EDIT LOGIC ===
function handleCardClick(el) {
    if (isSwiping || currentX < -40) return;
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
