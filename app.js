import { authService, categoryService, expenseService, tokenService } from "./services.js";
import { showAuth, toggleAuth, toggleCategoryModal, toggleSelectMode, closeEditModal, toggleAddModal, toggleChatModal, openBulkEditModal, closeBulkEditModal, toggleSiriModal, escapeHtml } from "./ui.js";
import { renderCategories, updateCategorySelects, renderRecent, renderDashboard, renderYearlyChart } from "./render.js";
import { store } from "./state.js";



document.addEventListener("DOMContentLoaded", () => {
    setDefaultDateRange();
    checkUser();
});

export async function checkUser() {
    const { data: { session } } = await authService.getSession();
    if (session) {
        store.currentUser = session.user;
        showApp();
    } else {
        showAuth();
    }

    authService.onAuthStateChange((event, session) => {
        if (session) {
            store.currentUser = session.user;
            showApp();
        } else {
            store.currentUser = null;
            showAuth();
        }
    });
}







export async function signIn(event) {
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
    
    const { data, error } = await authService.signIn(email, password);
    
    if (error) {
        msg.innerText = error.message;
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Sign In";
        }
    } else {
        msg.innerText = "Signed in successfully!";
        store.currentUser = data.session.user;
        showApp();
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Sign In";
        }
        document.getElementById('signin-password').value = '';
    }
}

export async function signUp(event) {
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
    
    const { data, error } = await authService.signUp(email, password);
    
    if (error) {
        msg.innerText = error.message;
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Create Account";
        }
    } else {
        msg.innerText = "Account created! Adding default store.categories...";
        const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
        if (userId) {
            const defaults = ['Housing', 'Utilities', 'Insurance', 'Groceries', 'Dining Out', 'Transportation', 'Household', 'Health & Care', 'Subscriptions', 'Shopping', 'Entertainment', 'Travel', 'Gifts', 'Education', 'Misc'];
            const inserts = defaults.map(name => ({ name: name, user_id: userId }));
            await categoryService.createDefaults(userId, defaults);
        }
        msg.innerText = "Check your email to confirm, or you may be logged in!";
        if (data.session) {
            store.currentUser = data.session.user;
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

export async function signOut() {
    await authService.signOut();
}

// --- Categories ---



export async function fetchCategories() {
    if (!store.currentUser) return;
    const { data, error } = await categoryService.fetchAll(store.currentUser.id);
        
    if (error) {
        console.error("Error fetching categories:", error);
        return;
    }
    
    const seen = new Set();
    store.categories = [];
    (data || []).forEach(cat => {
        const lowerName = cat.name.trim().toLowerCase();
        if (!seen.has(lowerName)) {
            seen.add(lowerName);
            store.categories.push(cat);
        }
    });
    renderCategories(editCategory, deleteCategory);
    updateCategorySelects();
}



export function showCategoryError(msg) {
    const errEl = document.getElementById('category-error');
    if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = msg ? 'block' : 'none';
    } else if (msg) {
        alert(msg);
    }
}

export async function addCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    showCategoryError('');
    
    if (!name) return;
    
    const lowerName = name.toLowerCase();
    const exists = store.categories.some(cat => cat.name.trim().toLowerCase() === lowerName);
    if (exists) {
        showCategoryError('Category already exists.');
        return;
    }
    
    const { data, error } = await categoryService.add(store.currentUser.id, name);
        
    if (error) {
        showCategoryError("Error adding category: " + error.message);
    } else {
        input.value = '';
        fetchCategories();
    }
}

export async function editCategory(id, oldName) {
    const newName = prompt("Enter new category name:", oldName);
    if (!newName) return;
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === oldName) return;

    const lowerName = trimmedName.toLowerCase();
    const exists = store.categories.some(cat => cat.name.trim().toLowerCase() === lowerName && cat.id !== id);
    if (exists) {
        showCategoryError('Category already exists.');
        return;
    }

    showCategoryError('');
    
    const { error: catError } = await categoryService.update(id, trimmedName);

    if (catError) {
        showCategoryError("Error updating category: " + catError.message);
        return;
    }

    const { error: expError } = await expenseService.updateCategoryName(store.currentUser.id, oldName, trimmedName);

    if (expError) {
        console.error("Error cascading expense update:", expError);
    }

    fetchCategories();
    if (typeof fetchExpenses === 'function') {
        fetchExpenses();
    }
}

export async function deleteCategory(id) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    showCategoryError('');
    const { error } = await categoryService.delete(id);
        
    if (error) {
        showCategoryError("Error deleting category: " + error.message);
    } else {
        fetchCategories();
    }
}

// --- Expenses ---

export async function fetchExpenses() {
    if (!store.currentUser) return;
    try {
        const { data, error } = await expenseService.fetchAll(store.currentUser.id);

        if (error) throw error;
        
        store.expenses = data || [];
        renderDashboard(getFilteredExpenses(), showCategoryDetails);
        renderRecent(getFilteredExpenses());
        if (typeof renderYearlyChart === 'function') renderYearlyChart(showMonthDetails);
    } catch (e) {
        console.error("Error fetching data:", e);
    }
}

export async function addExpense() {
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
        const { error } = await expenseService.add(store.currentUser.id, date, item, amount, category);

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




export function handleExpenseClick(el) {
    if (store.isSelectMode) {
        const checkbox = el.querySelector('.expense-checkbox');
        checkbox.checked = !checkbox.checked;
        const id = el.getAttribute('data-id');
        if (checkbox.checked) store.selectedIds.add(id);
        else store.selectedIds.delete(id);
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

export function handleCheckboxClick(event, id) {
    event.stopPropagation();
    if (event.target.checked) store.selectedIds.add(id);
    else store.selectedIds.delete(id);
}



export function openEditModal(id, item, amount, category, date) {
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



export async function saveEdit() {
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
        const { error } = await expenseService.update(id, item, amount, category, date);
            
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

export async function deleteFromEdit() {
    const id = document.getElementById('edit-row').value;
    if (!confirm("Are you sure you want to delete this expense?")) return;

    const btn = document.getElementById('delete-edit-btn');
    btn.disabled = true;
    btn.innerText = "Deleting...";

    try {
        const { error } = await expenseService.delete(id);
            
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

export async function deleteSelected() {
    if (store.selectedIds.size === 0) return;
    if (!confirm("Delete selected store.expenses? This cannot be undone.")) return;

    const btn = document.getElementById('bulk-delete-btn');
    btn.disabled = true;
    btn.innerText = "Deleting...";

    try {
        const idsToDelete = Array.from(store.selectedIds);
        const { error } = await expenseService.deleteBulk(idsToDelete);
            
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

export function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById("tab-" + tabId).classList.add('active');
    event.target.classList.add('active');
    if(tabId === 'yearly' && typeof renderYearlyChart === 'function') setTimeout(() => renderYearlyChart(showMonthDetails), 50);
}

export function toLocalDateString(dateObj) {
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
}

export function setDefaultDateRange() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('start-date').value = toLocalDateString(firstDay);
    document.getElementById('end-date').value = toLocalDateString(today);
}

export function getFilteredExpenses() {
    const startStr = document.getElementById('start-date').value || "0000-00-00";
    const endStr = document.getElementById('end-date').value || "9999-12-31";

    return store.expenses.filter(exp => {
        const eDateStr = String(exp.date || "").substring(0, 10);
        return eDateStr >= startStr && eDateStr <= endStr;
    });
}

export function applyDateFilter() { renderDashboard(getFilteredExpenses(), showCategoryDetails); }
export function clearDateFilter() {
    document.getElementById('start-date').value = "";
    document.getElementById('end-date').value = "";
    renderDashboard(getFilteredExpenses(), showCategoryDetails);
}


export function toggleCategoryExpand(label) {
    const safeLabel = label.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    const el = document.getElementById('cat-items-' + safeLabel);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

export function showMonthDetails(monthStr) {
    const container = document.getElementById('yearly-details-container');
    const monthExpenses = store.expenses.filter(exp => {
        const dateObj = new Date(exp.date);
        dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
        if (isNaN(dateObj.getTime())) return false;
        return toLocalDateString(dateObj).substring(0, 7) === monthStr;
    });
    const sortedItems = monthExpenses.sort((a,b) => new Date(b.date) - new Date(a.date));
    const itemsHtml = sortedItems.map(item => {
        const itemStr = escapeHtml(item.item).replace(/'/g, "\\'");
        const catStr = escapeHtml(item.category).replace(/'/g, "\\'");
        return `<div class="category-detail-item" data-id="${item.id}" data-item="${escapeHtml(item.item)}" data-amount="${item.amount}" data-category="${escapeHtml(item.category)}" data-date="${item.date}"><div class="detail-left"><span class="detail-name">${escapeHtml(item.item)} <small>(${escapeHtml(item.category)})</small></span><span class="detail-date">${new Date(item.date).toLocaleDateString()}</span></div><span class="detail-amount">$${parseFloat(item.amount).toFixed(2)}</span></div>`;
    }).join('');
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    const monthDisplay = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    container.innerHTML = `<h3>${monthDisplay} Details</h3>${itemsHtml}`;
    container.scrollIntoView({ behavior: 'smooth' });
}


window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('add-modal')) toggleAddModal();
    if (event.target === document.getElementById('edit-modal')) closeEditModal();
    if (event.target === document.getElementById('category-modal')) toggleCategoryModal();
    if (event.target === document.getElementById('chat-modal') && typeof toggleChatModal === 'function') toggleChatModal();
});




export async function sendChatMessage() {
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
            body: JSON.stringify({ message, expenses: store.expenses })
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
                    user_id: store.currentUser.id
                };
            });
            
            aiDiv.innerHTML = messageHtml;
            history.appendChild(aiDiv);
            
            const { error } = await expenseService.add(insertPayload.user_id, insertPayload.date, insertPayload.item, insertPayload.amount, insertPayload.category);
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

export function handleChatKeyPress(event) {
    if (event.key === 'Enter') sendChatMessage();
}


export function showCategoryDetails(categoryName, items) {
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
    setTimeout(() => container.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}






export async function saveBulkEdit() {
    if (store.selectedIds.size === 0) return;
    
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
        
        const idsToEdit = Array.from(store.selectedIds);
        
        const { error } = await expenseService.updateBulk(idsToEdit, updates);
            
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


export async function fetchExistingSiriToken() {
    const user = store.currentUser;
    if (!user) return;
    
    try {
        const { data, error } = await tokenService.fetchLatest(user.id);
            
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

export async function generateSiriToken() {
    const user = store.currentUser;
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
        
        const { data, error } = await tokenService.create(user.id, token);
            
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

export function copySiriToken() {
    const tokenInput = document.getElementById('siri-token-display');
    if (!tokenInput.value) {
        alert('No token to copy.');
        return;
    }
    
    tokenInput.select();
    tokenInput.setSelectionRange(0, 99999); // For mobile devices
    
    const successCallback = () => {
        const btn = document.getElementById('copy-siri-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tokenInput.value).then(successCallback).catch(err => {
            console.error('Failed to copy!', err);
            tryFallbackCopy();
        });
    } else {
        tryFallbackCopy();
    }
    
    function tryFallbackCopy() {
        try {
            document.execCommand('copy');
            successCallback();
        } catch (err) {
            console.error('Fallback copy failed', err);
            alert('Failed to copy to clipboard. Please select and copy manually.');
        }
    }
}
document.addEventListener('DOMContentLoaded', () => { document.getElementById('signin-form')?.addEventListener('submit', (e) => { e.preventDefault(); signIn(e); }); document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); signUp(e); }); document.getElementById('toggle-to-signup')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuth('signup'); }); document.getElementById('toggle-to-signin')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuth('signin'); }); });


// --- EVENT DELEGATION (Best Practice Refactor) ---
document.addEventListener('click', (e) => {
    // 1. Checkbox click
    const checkbox = e.target.closest('.expense-checkbox');
    if (checkbox) {
        const expenseItemDiv = checkbox.closest('.expense-item');
        if (expenseItemDiv) {
            const id = expenseItemDiv.getAttribute('data-id');
            handleCheckboxClick(e, id);
        }
        return;
    }

    // 2. Expense Item click
    const expenseItem = e.target.closest('.expense-item');
    if (expenseItem) {
        handleExpenseClick(expenseItem);
        return;
    }

    // 3. Category Detail / History Item click
    const categoryDetailItem = e.target.closest('.category-detail-item');
    if (categoryDetailItem) {
        const id = categoryDetailItem.getAttribute('data-id');
        const item = categoryDetailItem.getAttribute('data-item');
        const amount = categoryDetailItem.getAttribute('data-amount');
        const category = categoryDetailItem.getAttribute('data-category');
        const date = categoryDetailItem.getAttribute('data-date');
        
        // Unescape HTML entities for the modal inputs
        const unescapeHtml = (text) => {
            if (!text) return '';
            const doc = new DOMParser().parseFromString(text, "text/html");
            return doc.documentElement.textContent;
        };
        
        openEditModal(id, unescapeHtml(item), amount, unescapeHtml(category), date);
    }
});

// Expose functions to global scope for event listeners

window.togglePasswordVisibility = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
        input.type = 'password';
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
};

export function showApp() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'block';
        if (document.getElementById('siri-btn')) document.getElementById('siri-btn').style.display = 'block';
    fetchCategories();
    fetchExpenses();
}
