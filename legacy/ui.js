import { store } from "./state.js";
import { fetchExistingSiriToken } from "./app.js";
import { toLocalDateString } from "./utils.js";

export function showAuth() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
        if (document.getElementById('siri-btn')) document.getElementById('siri-btn').style.display = 'none';
}

export function toggleAuth(view) {
    if (view === 'signup') {
        document.getElementById('signin-card').style.display = 'none';
        document.getElementById('signup-card').style.display = 'block';
    } else {
        document.getElementById('signin-card').style.display = 'block';
        document.getElementById('signup-card').style.display = 'none';
    }
}

export function toggleCategoryModal() {
    const modal = document.getElementById('category-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

export function toggleSelectMode() {
    store.isSelectMode = !store.isSelectMode;
    const container = document.getElementById('tab-recent');
    if(store.isSelectMode) {
        container.classList.add('select-mode');
        document.getElementById('bulk-actions').style.display = 'flex';
        store.selectedIds.clear();
        document.querySelectorAll('.expense-checkbox').forEach(cb => cb.checked = false);
    } else {
        container.classList.remove('select-mode');
        document.getElementById('bulk-actions').style.display = 'none';
    }
}

export function closeEditModal() {
    document.getElementById('edit-modal').style.display = "none";
    document.body.classList.remove('modal-open');
}

export function toggleAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    } else {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        if (!document.getElementById('add-date').value) {
            document.getElementById('add-date').value = toLocalDateString(new Date());
        }
    }
}

export function toggleChatModal() {
    const modal = document.getElementById('chat-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    if (modal.style.display === 'flex') {
        document.getElementById('chat-input').focus();
    }
}

export function openBulkEditModal() {
    if (store.selectedIds.size === 0) return;
    document.getElementById('bulk-edit-date').value = '';
    document.getElementById('bulk-edit-category').value = '';
    document.getElementById('bulk-edit-modal').style.display = 'block';
    document.body.classList.add('modal-open');
}

export function closeBulkEditModal() {
    document.getElementById('bulk-edit-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
}

export function toggleSiriModal() {
    const modal = document.getElementById('siri-modal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        fetchExistingSiriToken();
        const urlElem = document.getElementById("siri-endpoint-url");
        if (urlElem) { urlElem.textContent = window.location.origin + "/api/siri"; }
    }
}

export function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

