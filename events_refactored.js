import { signOut, showMonthDetails, addCategory, addExpense, saveEdit, deleteFromEdit, deleteSelected, switchTab, applyDateFilter, clearDateFilter, sendChatMessage, handleChatKeyPress, saveBulkEdit, generateSiriToken, copySiriToken } from "./app.js";
import { toggleCategoryModal, toggleSelectMode, closeEditModal, toggleAddModal, toggleChatModal, openBulkEditModal, closeBulkEditModal, toggleSiriModal } from "./ui.js";
import { renderYearlyChart } from "./render.js";


// --- EVENT LISTENERS (Best Practice Refactor) ---
document.addEventListener('DOMContentLoaded', () => {
    const el_siri_btn = document.getElementById('siri-btn');
    if (el_siri_btn) el_siri_btn.addEventListener('click', (e) => { toggleSiriModal() });
    const el_logout_btn = document.getElementById('logout-btn');
    if (el_logout_btn) el_logout_btn.addEventListener('click', (e) => { signOut() });
    const el_action_elem_1 = document.getElementById('action-elem-1');
    if (el_action_elem_1) el_action_elem_1.addEventListener('click', (e) => { switchTab('dashboard') });
    const el_action_elem_2 = document.getElementById('action-elem-2');
    if (el_action_elem_2) el_action_elem_2.addEventListener('click', (e) => { switchTab('recent') });
    const el_action_elem_3 = document.getElementById('action-elem-3');
    if (el_action_elem_3) el_action_elem_3.addEventListener('click', (e) => { switchTab('yearly') });
    const el_start_date = document.getElementById('start-date');
    if (el_start_date) el_start_date.addEventListener('change', (e) => { applyDateFilter() });
    const el_end_date = document.getElementById('end-date');
    if (el_end_date) el_end_date.addEventListener('change', (e) => { applyDateFilter() });
    const el_action_elem_4 = document.getElementById('action-elem-4');
    if (el_action_elem_4) el_action_elem_4.addEventListener('click', (e) => { clearDateFilter() });
    const el_yearSelect = document.getElementById('yearSelect');
    if (el_yearSelect) el_yearSelect.addEventListener('change', (e) => { renderYearlyChart(showMonthDetails) });
    const el_select_mode_btn = document.getElementById('select-mode-btn');
    if (el_select_mode_btn) el_select_mode_btn.addEventListener('click', (e) => { toggleSelectMode() });
    const el_bulk_edit_btn = document.getElementById('bulk-edit-btn');
    if (el_bulk_edit_btn) el_bulk_edit_btn.addEventListener('click', (e) => { openBulkEditModal() });
    const el_bulk_delete_btn = document.getElementById('bulk-delete-btn');
    if (el_bulk_delete_btn) el_bulk_delete_btn.addEventListener('click', (e) => { deleteSelected() });
    const el_action_elem_5 = document.getElementById('action-elem-5');
    if (el_action_elem_5) el_action_elem_5.addEventListener('click', (e) => { closeBulkEditModal() });
    const el_save_bulk_edit_btn = document.getElementById('save-bulk-edit-btn');
    if (el_save_bulk_edit_btn) el_save_bulk_edit_btn.addEventListener('click', (e) => { saveBulkEdit() });
    const el_action_elem_6 = document.getElementById('action-elem-6');
    if (el_action_elem_6) el_action_elem_6.addEventListener('click', (e) => { closeEditModal() });
    const el_save_edit_btn = document.getElementById('save-edit-btn');
    if (el_save_edit_btn) el_save_edit_btn.addEventListener('click', (e) => { saveEdit() });
    const el_delete_edit_btn = document.getElementById('delete-edit-btn');
    if (el_delete_edit_btn) el_delete_edit_btn.addEventListener('click', (e) => { deleteFromEdit() });
    const el_action_elem_7 = document.getElementById('action-elem-7');
    if (el_action_elem_7) el_action_elem_7.addEventListener('click', (e) => { toggleCategoryModal() });
    const el_action_elem_8 = document.getElementById('action-elem-8');
    if (el_action_elem_8) el_action_elem_8.addEventListener('click', (e) => { toggleChatModal() });
    const el_fab = document.getElementById('fab');
    if (el_fab) el_fab.addEventListener('click', (e) => { toggleAddModal() });
    const el_action_elem_9 = document.getElementById('action-elem-9');
    if (el_action_elem_9) el_action_elem_9.addEventListener('click', (e) => { toggleAddModal() });
    const el_add_expense_btn = document.getElementById('add-expense-btn');
    if (el_add_expense_btn) el_add_expense_btn.addEventListener('click', (e) => { addExpense() });
    const el_action_elem_10 = document.getElementById('action-elem-10');
    if (el_action_elem_10) el_action_elem_10.addEventListener('click', (e) => { toggleCategoryModal() });
    const el_action_elem_11 = document.getElementById('action-elem-11');
    if (el_action_elem_11) el_action_elem_11.addEventListener('click', (e) => { addCategory() });
    const el_action_elem_12 = document.getElementById('action-elem-12');
    if (el_action_elem_12) el_action_elem_12.addEventListener('click', (e) => { toggleSiriModal() });
    const el_siri_token_display = document.getElementById('siri-token-display');
    if (el_siri_token_display) el_siri_token_display.addEventListener('click', (e) => { copySiriToken() });
    const el_generate_siri_btn = document.getElementById('generate-siri-btn');
    if (el_generate_siri_btn) el_generate_siri_btn.addEventListener('click', (e) => { generateSiriToken() });
    const el_copy_siri_btn = document.getElementById('copy-siri-btn');
    if (el_copy_siri_btn) el_copy_siri_btn.addEventListener('click', (e) => { copySiriToken() });
    const el_action_elem_13 = document.getElementById('action-elem-13');
    if (el_action_elem_13) el_action_elem_13.addEventListener('click', (e) => { toggleChatModal() });
    const el_chat_input = document.getElementById('chat-input');
    if (el_chat_input) el_chat_input.addEventListener('keypress', handleChatKeyPress);
    const el_send_chat_btn = document.getElementById('send-chat-btn');
    if (el_send_chat_btn) el_send_chat_btn.addEventListener('click', (e) => { sendChatMessage() });
});

// iOS Keyboard Gap Fix using visualViewport
if (window.visualViewport) {
    const updateViewport = () => {
        const modals = document.querySelectorAll('.modal-content, .chat-modal-content');
        const offset = window.innerHeight - window.visualViewport.height;
        modals.forEach(modal => {
            if (modal.offsetParent !== null) { // If visible
                modal.style.marginBottom = offset > 0 ? `${offset}px` : '0px';
            }
        });
    };
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
}
