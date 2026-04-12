// Supabase Configuration
const supabaseUrl = 'https://zjanajeevdvhbeuyflmg.supabase.co';
const supabaseKey = 'sb_publishable_alSzFV8OWSBkCnF8z5-0_Q_2MefRVwD';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let expenses = [];
let categories = [];
let chartInstance = null;
let isSelectMode = false;
let selectedIds = new Set();

document.addEventListener("DOMContentLoaded", () => {
    setDefaultDateRange();
    checkUser();
});

async function checkUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showAuth();
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUser = session.user;
            showApp();
        } else {
            currentUser = null;
            showAuth();
        }
    });
}

function showAuth() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
        if (document.getElementById('siri-btn')) document.getElementById('siri-btn').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'block';
        if (document.getElementById('siri-btn')) document.getElementById('siri-btn').style.display = 'block';
    fetchCategories();
    fetchExpenses();
}

function toggleAuth(view) {
    if (view === 'signup') {
        document.getElementById('signin-card').style.display = 'none';
        document.getElementById('signup-card').style.display = 'block';
    } else {
        document.getElementById('signin-card').style.display = 'block';
        document.getElementById('signup-card').style.display = 'none';
    }
}


async function signIn() {
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    const msg = document.getElementById('signin-message');
    const btn = document.getElementById('signin-btn');
    
    if (!email || !password) {
        msg.innerText = "Please enter email and password.";
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Signing in...";
    }
    msg.innerText = "";
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        msg.innerText = error.message;
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Sign In";
        }
    } else {
        msg.innerText = "Signed in successfully!";
        currentUser = data.session.user;
        showApp();
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Sign In";
        }
        document.getElementById('signin-password').value = '';
    }
}

async function signUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const msg = document.getElementById('signup-message');
    const btn = document.getElementById('signup-btn');
    
    if (!email || !password) {
        msg.innerText = "Please enter email and password.";
        return;
    }
    if (password !== confirmPassword) {
        msg.innerText = "Passwords do not match.";
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Signing up...";
    }
    msg.innerText = "";
    
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    
    if (error) {
        msg.innerText = error.message;
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Create Account";
        }
    } else {
        msg.innerText = "Account created! Adding default categories...";
        const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
        if (userId) {
            const defaults = ['Housing', 'Utilities', 'Insurance', 'Groceries', 'Dining Out', 'Transportation', 'Household', 'Health & Care', 'Subscriptions', 'Shopping', 'Entertainment', 'Travel', 'Gifts', 'Education', 'Misc'];
            const inserts = defaults.map(name => ({ name: name, user_id: userId }));
            await supabaseClient.from('categories').insert(inserts);
        }
        msg.innerText = "Check your email to confirm, or you may be logged in!";
        if (data.session) {
            currentUser = data.session.user;
            showApp();
        }
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Create Account";
        }
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm-password').value = '';
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
}

// --- Categories ---

function toggleCategoryModal() {
    const modal = document.getElementById('category-modal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

async function fetchCategories() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name', { ascending: true });
        
    if (error) {
        console.error("Error fetching categories:", error);
        return;
    }
    
    const seen = new Set();
    categories = [];
    (data || []).forEach(cat => {
        const lowerName = cat.name.trim().toLowerCase();
        if (!seen.has(lowerName)) {
            seen.add(lowerName);
            categories.push(cat);
        }
    });
    renderCategories();
    updateCategorySelects();
}

function renderCategories() {
    const list = document.getElementById('category-list');
    if (!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '8px 15px';
        li.style.background = '#ffffff';
        li.style.borderRadius = '8px';
        li.style.marginBottom = '8px';
        li.style.border = '1px solid #dadce0';
        li.style.transition = 'box-shadow 0.2s';
        li.onmouseover = () => li.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
        li.onmouseout = () => li.style.boxShadow = 'none';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = cat.name;
        nameSpan.style.fontWeight = '500';
        nameSpan.style.color = '#3c4043';
        nameSpan.style.flex = '1';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '8px';
        actionsDiv.style.alignItems = 'center';

        const createBtn = (svgPath, color, hoverColor, onClick) => {
            const btn = document.createElement('button');
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
            btn.style.padding = '6px';
            btn.style.borderRadius = '50%';
            btn.style.background = 'transparent';
            btn.style.color = color;
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.transition = 'all 0.2s';
            btn.onmouseover = () => { btn.style.background = '#f1f3f4'; btn.style.color = hoverColor; };
            btn.onmouseout = () => { btn.style.background = 'transparent'; btn.style.color = color; };
            btn.onclick = onClick;
            return btn;
        };

        const editSvg = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>';
        const deleteSvg = '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>';

        const editBtn = createBtn(editSvg, '#5f6368', '#1a73e8', () => editCategory(cat.id, cat.name));
        const delBtn = createBtn(deleteSvg, '#5f6368', '#d93025', () => deleteCategory(cat.id));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);

        li.appendChild(nameSpan);
        li.appendChild(actionsDiv);
        list.appendChild(li);
    });
}

function updateCategorySelects() {
    const addSelect = document.getElementById('add-category');
    const editSelect = document.getElementById('edit-category');
    if (!addSelect || !editSelect) return;
    
    addSelect.innerHTML = '';
    editSelect.innerHTML = '';
    const bulkSelect = document.getElementById('bulk-edit-category');
    if (bulkSelect) {
        bulkSelect.innerHTML = '<option value="">-- Keep Existing Category --</option>';
    }
    
    categories.forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat.name;
        opt1.innerText = cat.name;
        addSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = cat.name;
        opt2.innerText = cat.name;
        editSelect.appendChild(opt2);
        
        if (bulkSelect) {
            const opt3 = document.createElement('option');
            opt3.value = cat.name;
            opt3.innerText = cat.name;
            bulkSelect.appendChild(opt3);
        }
    });
}

function showCategoryError(msg) {
    const errEl = document.getElementById('category-error');
    if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = msg ? 'block' : 'none';
    } else if (msg) {
        alert(msg);
    }
}

async function addCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    showCategoryError('');
    
    if (!name) return;
    
    const lowerName = name.toLowerCase();
    const exists = categories.some(cat => cat.name.trim().toLowerCase() === lowerName);
    if (exists) {
        showCategoryError('Category already exists.');
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('categories')
        .insert([{ name: name, user_id: currentUser.id }]);
        
    if (error) {
        showCategoryError("Error adding category: " + error.message);
    } else {
        input.value = '';
        fetchCategories();
    }
}

async function editCategory(id, oldName) {
    const newName = prompt("Enter new category name:", oldName);
    if (!newName) return;
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === oldName) return;

    const lowerName = trimmedName.toLowerCase();
    const exists = categories.some(cat => cat.name.trim().toLowerCase() === lowerName && cat.id !== id);
    if (exists) {
        showCategoryError('Category already exists.');
        return;
    }

    showCategoryError('');
    
    const { error: catError } = await supabaseClient
        .from('categories')
        .update({ name: trimmedName })
        .eq('id', id);

    if (catError) {
        showCategoryError("Error updating category: " + catError.message);
        return;
    }

    const { error: expError } = await supabaseClient
        .from('expenses')
        .update({ category: trimmedName })
        .eq('user_id', currentUser.id)
        .eq('category', oldName);

    if (expError) {
        console.error("Error cascading expense update:", expError);
    }

    fetchCategories();
    if (typeof fetchExpenses === 'function') {
        fetchExpenses();
    }
}

async function deleteCategory(id) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    showCategoryError('');
    const { error } = await supabaseClient
        .from('categories')
        .delete()
        .eq('id', id);
        
    if (error) {
        showCategoryError("Error deleting category: " + error.message);
    } else {
        fetchCategories();
    }
}

// --- Expenses ---

async function fetchExpenses() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('expenses')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false });

        if (error) throw error;
        
        expenses = data || [];
        renderDashboard();
        renderRecent();
        if (typeof renderYearlyChart === 'function') renderYearlyChart();
    } catch (e) {
        console.error("Error fetching data:", e);
    }
}

async function addExpense() {
    const date = document.getElementById('add-date').value;
    const item = document.getElementById('add-item').value;
    const amount = parseFloat(document.getElementById('add-amount').value);
    const category = document.getElementById('add-category').value;
    const btn = document.getElementById('add-expense-btn');

    if (!date || !item || isNaN(amount) || !category) {
        alert("Please fill in all valid fields. Did you create a category first?");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Adding...";

    try {
        const { error } = await supabaseClient
            .from('expenses')
            .insert([{
                user_id: currentUser.id,
                date: date,
                item: item,
                amount: amount,
                category: category
            }]);

        if (error) throw error;

        document.getElementById('add-item').value = "";
        document.getElementById('add-amount').value = "";
        toggleAddModal();
        await fetchExpenses();
    } catch (e) {
        alert("Error adding expense: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Add Expense";
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function renderRecent() {
    const list = document.getElementById('recent-list');
    if (!list) return;
    list.innerHTML = "";

    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(exp => {
        const d = new Date(exp.date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Unknown Date';
        const amt = parseFloat(exp.amount) || 0;

        const idSafe = escapeHtml(exp.id);
        const itemSafe = escapeHtml(exp.item);
        const catSafe = escapeHtml(exp.category);
        const dateSafe = escapeHtml(exp.date);

        list.innerHTML += '<div class="expense-item" data-id="' + idSafe + '" data-item="' + itemSafe + '" data-amount="' + amt + '" data-category="' + catSafe + '" data-date="' + dateSafe + '" onclick="handleExpenseClick(this)">' +
                '<input type="checkbox" class="expense-checkbox" onclick="handleCheckboxClick(event, \'' + idSafe + '\')">' +
                '<div class="expense-info">' +
                    '<h4>' + itemSafe + '</h4>' +
                    '<p>' + catSafe + ' &bull; ' + dateStr + '</p>' +
                '</div>' +
                '<div class="expense-amount">$' + amt.toFixed(2) + '</div>' +
            '</div>';
    });
    
    if (isSelectMode) toggleSelectMode();
}

function handleExpenseClick(el) {
    if (isSelectMode) {
        const checkbox = el.querySelector('.expense-checkbox');
        checkbox.checked = !checkbox.checked;
        const id = el.getAttribute('data-id');
        if (checkbox.checked) selectedIds.add(id);
        else selectedIds.delete(id);
    } else {
        openEditModal(
            el.getAttribute('data-id'),
            el.getAttribute('data-item'),
            el.getAttribute('data-amount'),
            el.getAttribute('data-category'),
            el.getAttribute('data-date')
        );
    }
}

function handleCheckboxClick(event, id) {
    event.stopPropagation();
    if (event.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
}

function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    const container = document.getElementById('tab-recent');
    if(isSelectMode) {
        container.classList.add('select-mode');
        document.getElementById('bulk-actions').style.display = 'flex';
        selectedIds.clear();
        document.querySelectorAll('.expense-checkbox').forEach(cb => cb.checked = false);
    } else {
        container.classList.remove('select-mode');
        document.getElementById('bulk-actions').style.display = 'none';
    }
}

function openEditModal(id, item, amount, category, date) {
    document.getElementById('edit-row').value = id;

    const txt = document.createElement("textarea");
    txt.innerHTML = item;
    document.getElementById('edit-item').value = txt.value;
    document.getElementById('edit-amount').value = amount;

    txt.innerHTML = category;
    document.getElementById('edit-category').value = txt.value;
    
    if (date) document.getElementById('edit-date').value = date;
    
    document.getElementById('edit-modal').style.display = "block";
    document.body.classList.add('modal-open');
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = "none";
    document.body.classList.remove('modal-open');
}

async function saveEdit() {
    const id = document.getElementById('edit-row').value;
    const item = document.getElementById('edit-item').value.trim();
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const category = document.getElementById('edit-category').value.trim();
    const date = document.getElementById('edit-date').value;
    
    if (!item || isNaN(amount) || !category || !date) {
        alert("Please fill in all valid fields");
        return;
    }

    const btn = document.getElementById('save-edit-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const { error } = await supabaseClient
            .from('expenses')
            .update({ item, amount, category, date })
            .eq('id', id);
            
        if (error) throw error;
        
        closeEditModal();
        await fetchExpenses();
    } catch (error) {
        console.error("Edit error:", error);
        alert("Failed to edit expense: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }
}

async function deleteFromEdit() {
    const id = document.getElementById('edit-row').value;
    if (!confirm("Are you sure you want to delete this expense?")) return;

    const btn = document.getElementById('delete-edit-btn');
    btn.disabled = true;
    btn.innerText = "Deleting...";

    try {
        const { error } = await supabaseClient
            .from('expenses')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        closeEditModal();
        await fetchExpenses();
    } catch (e) {
        alert("Delete failed: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Delete";
    }
}

async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm("Delete selected expenses? This cannot be undone.")) return;

    const btn = document.getElementById('bulk-delete-btn');
    btn.disabled = true;
    btn.innerText = "Deleting...";

    try {
        const idsToDelete = Array.from(selectedIds);
        const { error } = await supabaseClient
            .from('expenses')
            .delete()
            .in('id', idsToDelete);
            
        if (error) throw error;
        
        await fetchExpenses();
    } catch (e) {
        alert("Bulk delete failed: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Delete Selected";
    }
}

// --- Utilities & Standard UI ---

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById("tab-" + tabId).classList.add('active');
    event.target.classList.add('active');
    if(tabId === 'yearly' && typeof renderYearlyChart === 'function') setTimeout(renderYearlyChart, 50);
}

function toLocalDateString(dateObj) {
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
}

function setDefaultDateRange() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('start-date').value = toLocalDateString(firstDay);
    document.getElementById('end-date').value = toLocalDateString(today);
}

function getFilteredExpenses() {
    const startStr = document.getElementById('start-date').value || "0000-00-00";
    const endStr = document.getElementById('end-date').value || "9999-12-31";

    return expenses.filter(exp => {
        const eDateStr = String(exp.date || "").substring(0, 10);
        return eDateStr >= startStr && eDateStr <= endStr;
    });
}

function applyDateFilter() { renderDashboard(); }
function clearDateFilter() {
    document.getElementById('start-date').value = "";
    document.getElementById('end-date').value = "";
    renderDashboard();
}

function renderDashboard() {
    const filtered = getFilteredExpenses();
    const total = filtered.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    document.getElementById('total-amount').innerText = "$" + total.toFixed(2);

    const byCategory = {};
    filtered.forEach(exp => {
        if (!byCategory[exp.category]) byCategory[exp.category] = { total: 0, items: [] };
        byCategory[exp.category].total += (parseFloat(exp.amount) || 0);
        byCategory[exp.category].items.push(exp);
    });

    const labels = Object.keys(byCategory).sort((a,b) => byCategory[b].total - byCategory[a].total);
    const data = labels.map(label => byCategory[label].total);
    const bgColors = labels.map((_, i) => "hsl(" + (i * (360 / labels.length)) + ", 70%, 60%)");

    document.querySelector('.chart-container').style.height = Math.max(300, labels.length * 40 + 50) + 'px';
    const ctx = document.getElementById("expenseChart").getContext("2d");
    Chart.register(window.ChartDataLabels);
    if (chartInstance) chartInstance.destroy();

    if (labels.length === 0) {
        document.getElementById('category-details-container').innerHTML = "<p>No expenses in this range.</p>";
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Category',
                data: data,
                backgroundColor: labels.map((_, i) => `hsl(0, 0%, ${15 + (i * 65) / Math.max(1, labels.length - 1)}%)`),
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            maintainAspectRatio: false,
            responsive: true, 
            interaction: { mode: "y", intersect: false },
            layout: {
                padding: { right: 60 }
            },
            scales: {
                x: { display: false },
                y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 14 }, color: '#000' } }
            },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    formatter: (value) => '$' + Math.round(parseFloat(value)).toLocaleString(),
                    color: '#000',
                    font: { weight: '600', size: 13 }
                }
            },
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const categoryName = labels[index];
                    showCategoryDetails(categoryName, byCategory[categoryName].items);
                }
            }
        }
    });

    document.getElementById("category-details-container").innerHTML = "";
}

function toggleCategoryExpand(label) {
    const safeLabel = label.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    const el = document.getElementById('cat-items-' + safeLabel);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function showMonthDetails(monthStr) {
    const container = document.getElementById('yearly-details-container');
    const monthExpenses = expenses.filter(exp => {
        const dateObj = new Date(exp.date);
        if (isNaN(dateObj.getTime())) return false;
        return toLocalDateString(dateObj).substring(0, 7) === monthStr;
    });
    const sortedItems = monthExpenses.sort((a,b) => new Date(b.date) - new Date(a.date));
    const itemsHtml = sortedItems.map(item => {
        const itemStr = escapeHtml(item.item).replace(/'/g, "\\'");
        const catStr = escapeHtml(item.category).replace(/'/g, "\\'");
        return `<div class="category-detail-item" onclick="openEditModal('${item.id}', '${itemStr}', '${item.amount}', '${catStr}', '${item.date}')"><div class="detail-left"><span class="detail-name">${escapeHtml(item.item)} <small>(${escapeHtml(item.category)})</small></span><span class="detail-date">${new Date(item.date).toLocaleDateString()}</span></div><span class="detail-amount">$${parseFloat(item.amount).toFixed(2)}</span></div>`;
    }).join('');
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    const monthDisplay = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    container.innerHTML = `<h3>${monthDisplay} Details</h3>${itemsHtml}`;
    container.scrollIntoView({ behavior: 'smooth' });
}
function renderYearlyChart() {
    const years = new Set();
    expenses.forEach(exp => {
        const d = new Date(exp.date);
        if (!isNaN(d.getTime())) years.add(d.getFullYear().toString());
    });
    const sortedYears = Array.from(years).sort((a,b) => b - a);

    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    let selectedYear = yearSelect.value;
    yearSelect.innerHTML = '';
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });
    
    if (!selectedYear || !sortedYears.includes(selectedYear)) {
        selectedYear = sortedYears.length > 0 ? sortedYears[0] : new Date().getFullYear().toString();
    }
    yearSelect.value = selectedYear;

    const byMonth = {};
    for(let i=0; i<12; i++) byMonth[i] = null;

    expenses.forEach(exp => {
        const d = new Date(exp.date);
        if (isNaN(d.getTime()) || d.getFullYear().toString() !== selectedYear) return;
        const m = d.getMonth();
        if (byMonth[m] === null) byMonth[m] = 0;
        byMonth[m] += (parseFloat(exp.amount) || 0);
    });

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = labels.map((_, i) => byMonth[i]);

    const datasets = [{
        label: 'Expenses', 
        data: data, 
        backgroundColor: '#b0b0b0', 
        hoverBackgroundColor: '#808080', 
        borderRadius: 4, 
        borderSkipped: false, 
        maxBarThickness: 40
    }];

    if (window.yearlyChartInstance) window.yearlyChartInstance.destroy();
    const canvas = document.getElementById('yearlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    window.yearlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            maintainAspectRatio: false,
            responsive: true, 
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: '#000000', font: { weight: 'bold' } } },
                y: { grid: { display: false }, border: { display: false }, ticks: { display: false }, min: 0 }
            },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: function(context) { return context.dataset.data[context.dataIndex] !== null; },
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    formatter: (value) => '$' + Math.round(parseFloat(value)).toLocaleString(),
                    color: '#000',
                    font: { weight: '600', size: 12 }
                } 
            },
            onHover: (event, chartElement) => { 
                if (event.native && event.native.target) event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default'; 
            }, 
            onClick: (e, activeEls) => { 
                let idx = -1; 
                if (activeEls && activeEls.length > 0) idx = activeEls[0].index; 
                else if (window.yearlyChartInstance) { 
                    const els = window.yearlyChartInstance.getElementsAtEventForMode(e, 'index', {intersect: false}, false); 
                    if (els && els.length > 0) idx = els[0].index; 
                } 
                if (idx != -1 && data[idx] !== null) {
                    const monthStr = String(idx + 1).padStart(2, '0');
                    showMonthDetails(`${selectedYear}-${monthStr}`);
                }
            }
        }
    });
}
function toggleAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    } else {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        if (!document.getElementById('add-date').value) {
            document.getElementById('add-date').value = toLocalDateString(new Date());
        }
    }
}

window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('add-modal')) toggleAddModal();
    if (event.target === document.getElementById('edit-modal')) closeEditModal();
    if (event.target === document.getElementById('category-modal')) toggleCategoryModal();
});


function toggleChatModal() {
    const modal = document.getElementById('chat-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    if (modal.style.display === 'flex') {
        document.getElementById('chat-input').focus();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    const history = document.getElementById('chat-history');
    
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user-message';
    userDiv.textContent = message;
    history.appendChild(userDiv);
    
    input.value = '';
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message ai-message';
    typingDiv.innerHTML = '<i>Thinking...</i>';
    history.appendChild(typingDiv);
    history.scrollTop = history.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, expenses })
        });
        
        const data = await response.json();
        if (history.contains(typingDiv)) history.removeChild(typingDiv);
        
        if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        
        const result = data.data;
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai-message';
        
        if (result.action === 'add') {
            const items = result.items || [result];
            let messageHtml = 'Adding expenses:<br>';
            const insertPayload = items.map(item => {
                messageHtml += '- $'+ item.amount + ' for ' + (item.description || item.item) + ' (' + item.category + ')<br>';
                return {
                    date: item.date || new Date().isoString().split('T')[0],
                    item: item.description || item.item,
                    amount: parseFloat(item.amount),
                    category: item.category,
                    user_id: currentUser.id
                };
            });
            
            aiDiv.innerHTML = messageHtml;
            history.appendChild(aiDiv);
            
            const { error } = await supabaseClient.from('expenses').insert(insertPayload);
            if (error) throw error;
            
            await fetchExpenses();
            
            const successDiv = document.createElement('div');
            successDiv.className = 'chat-message ai-message';
            successDiv.innerHTML = 'Added ' + items.length + ' expense(s) successfully!';
            history.appendChild(successDiv);
        } else {
            aiDiv.innerHTML = result.message || JSON.stringify(result);
            history.appendChild(aiDiv);
        }
    } catch (err) {
        if (history.contains(typingDiv)) history.removeChild(typingDiv);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message ai-message';
        errorDiv.style.color = 'red';
        errorDiv.textContent = 'Error: ' + err.message + ' | Raw: ' + JSON.stringify(err, Object.getOwnPropertyNames(err));
        history.appendChild(errorDiv);
    }
    history.scrollTop = history.scrollHeight;
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') sendChatMessage();
}


function showCategoryDetails(categoryName, items) {
    const container = document.getElementById('category-details-container');
    const sortedItems = items.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const itemsHtml = sortedItems.map(item => `
        <div class="category-detail-item"
             onclick="openEditModal('${item.id}', '${escapeHtml(item.item).replace(/'/g, "\\'")}', '${item.amount}', '${escapeHtml(item.category).replace(/'/g, "\\'")}', '${item.date}')">
            <div class="detail-left">
                <span class="detail-name">${escapeHtml(item.item)}</span>
                <span class="detail-date">${new Date(item.date).toLocaleDateString()}</span>
            </div>
            <span class="detail-amount">$${parseFloat(item.amount).toFixed(2)}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <h3>${escapeHtml(categoryName)} Details</h3>
        ${itemsHtml}
    `;
}


function openBulkEditModal() {
    if (selectedIds.size === 0) return;
    document.getElementById('bulk-edit-date').value = '';
    document.getElementById('bulk-edit-category').value = '';
    document.getElementById('bulk-edit-modal').style.display = 'block';
    document.body.classList.add('modal-open');
}

function closeBulkEditModal() {
    document.getElementById('bulk-edit-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
}

async function saveBulkEdit() {
    if (selectedIds.size === 0) return;
    
    const newDate = document.getElementById('bulk-edit-date').value;
    const newCategory = document.getElementById('bulk-edit-category').value;
    
    if (!newDate && !newCategory) {
        alert("No changes specified.");
        return;
    }
    
    const btn = document.getElementById('save-bulk-edit-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";
    
    try {
        const updates = {};
        if (newDate) updates.date = newDate;
        if (newCategory) updates.category = newCategory;
        
        const idsToEdit = Array.from(selectedIds);
        
        const { error } = await supabaseClient
            .from('expenses')
            .update(updates)
            .in('id', idsToEdit);
            
        if (error) throw error;
        
        closeBulkEditModal();
        toggleSelectMode(); // Exit select mode
        await fetchExpenses();
    } catch (e) {
        alert("Bulk edit failed: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Apply Changes";
    }
}


// --- SIRI SETUP LOGIC ---
function toggleSiriModal() {
    const modal = document.getElementById('siri-modal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        fetchExistingSiriToken();
    }
}

async function fetchExistingSiriToken() {
    const user = _supabase.auth.user();
    if (!user) return;
    
    try {
        const { data, error } = await _supabase
            .from('api_tokens')
            .select('token')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (error) throw error;
        
        const tokenInput = document.getElementById('siri-token-display');
        if (data && data.length > 0) {
            tokenInput.value = data[0].token;
        } else {
            tokenInput.value = '';
            tokenInput.placeholder = "No token generated yet."; setTimeout(() => { if (!tokenInput.value && confirm("No Siri token found. Generate one right now?")) generateSiriToken(); }, 500);
        }
    } catch (err) {
        console.error('Error fetching token:', err);
    }
}

async function generateSiriToken() {
    const user = _supabase.auth.user();
    if (!user) {
        alert('You must be logged in.');
        return;
    }
    
    const btn = document.getElementById('generate-siri-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Generating...';
    btn.disabled = true;
    
    try {
        // Generate a random token string
        const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const token = 'exp_sk_' + randomString;
        
        const { data, error } = await _supabase
            .from('api_tokens')
            .insert([
                { user_id: user.id, token: token }
            ]);
            
        if (error) throw error;
        
        document.getElementById('siri-token-display').value = token;
        alert('New token generated successfully! Old tokens are still valid until deleted.');
    } catch (err) {
        console.error('Error generating token:', err);
        alert('Failed to generate token: ' + (err.message || 'Unknown error'));
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function copySiriToken() {
    const tokenInput = document.getElementById('siri-token-display');
    if (!tokenInput.value) {
        alert('No token to copy.');
        return;
    }
    
    tokenInput.select();
    tokenInput.setSelectionRange(0, 99999); // For mobile devices
    
    navigator.clipboard.writeText(tokenInput.value).then(() => {
        const btn = document.getElementById('copy-siri-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy!', err);
        alert('Failed to copy to clipboard.');
    });
}
