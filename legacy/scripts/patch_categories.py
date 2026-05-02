with open('/usr/local/google/home/duynguyenn/expense-dashboard/app.js', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "const defaults =" in line:
        lines[i] = "            const defaults = ['Housing', 'Utilities', 'Insurance', 'Groceries', 'Dining Out', 'Transportation', 'Household', 'Health & Care', 'Subscriptions', 'Shopping', 'Entertainment', 'Travel', 'Gifts', 'Education', 'Misc'];\n"
with open('/usr/local/google/home/duynguyenn/expense-dashboard/app.js', 'w') as f:
    f.writelines(lines)
print("Categories updated via line replacement.")
