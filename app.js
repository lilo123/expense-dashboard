const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyA4L51xcdLzRAeQQmr5rOluihTa11nxJhtI1v48ME3xpGUBOJxEfoEKh6J7PrOdgBP/exec";
const WEB_SECRET = "ExpenseDashboard741236";

let expenses = [];
let chartInstance = null;
let isSelectMode = false;
let selectedRows = new Set();

document.addEventListener("DOMContentLoaded", () => {
    setDefaultDateRange();
    fetchExpenses();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.target.classList.add('active');
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

    const labels = Object.keys(byCategory).sort((a,b) => byCategory[b].total - byCategory[a].total);
    const data = labels.map(label => byCategory[label].total);

    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('expenseChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Category',
                data: data,
                backgroundColor: '#000000',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const categoryName = labels[index];
                    showCategoryDetails(categoryName, byCategory[categoryName].items);
                }
            }
        }
    });

    document.getElementById('category-details-container').innerHTML = "";
}

function showCategoryDetails(categoryName, items) {
    const container = document.getElementById('category-details-container');
    const sortedItems = items.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const itemsHtml = sortedItems.map(item => `
        <div class="category-detail-item" onclick="openEditModal(${item.row}, '${item.item.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', ${item.amount}, '${item.category}', '${item.date}')">
            <div class="detail-left">
                <span class="detail-name">${item.item}</span>
                <span class="detail-date">${new Date(item.date).toLocaleDateString()}</span>
            </div>
            <span class="detail-amount">$${parseFloat(item.amount).toFixed(2)}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <h3>${categoryName} Details</h3>
        ${itemsHtml}
    `;
}

function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    const list = document.getElementById('recent-list');
    const selectBtn = document.getElementById('select-mode-btn');
    const deleteBtn = document.getElementById('bulk-delete-btn');

    if (isSelectMode) {
        list.classList.add('select-mode');
        selectBtn.innerText = "Cancel";
        deleteBtn.style.display = "block";
        selectedRows.clear();
    } else {
        list.classList.remove('select-mode');
        selectBtn.innerText = "Select";
        deleteBtn.style.display = "none";
        document.querySelectorAll('.expense-checkbox').forEach(cb => cb.checked = false);
    }
}

function handleExpenseClick(row, item, amount, category, date, element) {
    if (isSelectMode) {
        const cb = element.querySelector('.expense-checkbox');
        cb.checked = !cb.checked;
        if (cb.checked) {
            selectedRows.add(row);
        } else {
            selectedRows.delete(row);
        }
    } else {
        openEditModal(row, item, amount, category, date);
    }
}

function handleCheckboxClick(event, row) {
    event.stopPropagation();
    if (event.target.checked) {
        selectedRows.add(row);
    } else {
        selectedRows.delete(row);
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
            <div class="expense-item" onclick="handleExpenseClick(${exp.row}, '${exp.item.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', ${amt}, '${exp.category}', '${exp.date}', this)">
                <input type="checkbox" class="expense-checkbox" onclick="handleCheckboxClick(event, ${exp.row})">
                <div class="expense-info">
                    <h4>${exp.item}</h4>
                    <p>${exp.category} &bull; ${dateStr}</p>
                </div>
                <div class="expense-amount">$${amt.toFixed(2)}</div>
            </div>
        `;
    });
    
    if (isSelectMode) {
        toggleSelectMode();
    }
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
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target == modal) closeEditModal();
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
            body: JSON.stringify({ action: 'edit', row: row, item: item, amount: amount, category: category, date: date, secret: WEB_SECRET })
        });
        const result = await response.json();
        if (result.success) {
            closeEditModal();
            await fetchExpenses();
        } else {
            alert("Edit failed: " + result.error);
        }
    } catch (error) {
        alert("Failed to edit expense.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }
}

async function deleteFromEdit() {
    const row = document.getElementById('edit-row').value;
    if (!confirm("Are you sure you want to delete this expense?")) return;

    const btn = document.getElementById('delete-edit-btn');
    btn.disabled = true;
    btn.innerText = "Deleting...";

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'delete', row: row, secret: WEB_SECRET })
        });
        const result = await response.json();
        if (result.success) {
            closeEditModal();
            await fetchExpenses();
        } else {
            alert("Delete failed.");
        }
    } catch (e) {
        alert("Delete failed.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Delete";
    }
}

async function deleteSelected() {
    if (selectedRows.size === 0) return;
    if (!confirm(`Delete ${selectedRows.size} expenses? This cannot be undone.`)) return;

    const btn = document.getElementById('bulk-delete-btn');
    btn.disabled = true;
    btn.innerText = "Deleting...";

    // Sort rows descending so index shifts don't affect subsequent deletions
    const rowsToDelete = Array.from(selectedRows).sort((a, b) => b - a);

    try {
        for (const row of rowsToDelete) {
            await fetch(WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'delete', row: row, secret: WEB_SECRET })
            });
        }
        await fetchExpenses();
    } catch (e) {
        alert("Bulk delete encountered an error.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Delete Selected";
        // toggleSelectMode turns it off internally if it's on
        if (isSelectMode) toggleSelectMode();
    }
}
