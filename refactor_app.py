import os
import re

with open('app.js', 'r') as f:
    content = f.read()

# 1. Remove inline onclick for expense items
content = content.replace(' onclick="handleExpenseClick(this)"', '')

# 2. Remove inline onclick for checkboxes
content = re.sub(r' onclick="handleCheckboxClick\(event, [^\"]+\)"', '', content)

# 3 & 4. Replace openEditModal with data attributes (much simpler now since we don't need JS escaping inside the HTML attribute!)
content = re.sub(
    r' onclick="openEditModal\([^\"]+\)"',
    r' data-id="${item.id}" data-item="${escapeHtml(item.item)}" data-amount="${item.amount}" data-category="${escapeHtml(item.category)}" data-date="${item.date}"',
    content
)

delegation_code = """

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
"""

if "EVENT DELEGATION" not in content:
    content += delegation_code

with open('app.js', 'w') as f:
    f.write(content)

print("app.js refactored.")
