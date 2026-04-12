import re
with open('/usr/local/google/home/duynguyenn/expense-dashboard/app.js', 'r') as f:
    code = f.read()

new_cats = 'const defaults = ["Housing", "Utilities", "Insurance", "Groceries", "Dining Out", "Transportation", "Household", "Health & Care", "Subscriptions", "Shopping", "Entertainment", "Travel", "Gifts", "Education", "Misc"];'

code = re.sub(r'const defaults = \\[.*?\\];', new_cats, code)

with open('/usr/local/google/home/duynguyenn/expense-dashboard/app.js', 'w') as f:
    f.write(code)
print("Updated app.js with new categories!")
