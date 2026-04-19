import re

with open('app.js', 'r') as f:
    content = f.read()

# Remove global variable declarations
content = re.sub(r'let\s+(currentUser|expenses|categories|chartInstance|isSelectMode|selectedIds)\s*=\s*.*?;\n?', '', content)

# Safely replace variable usages with store.var
# We use word boundaries and negative lookbehind/lookahead to avoid replacing properties like obj.expenses or expenses: [1,2]
content = re.sub(r'(?<![.\\w])(currentUser|expenses|categories|chartInstance|isSelectMode|selectedIds)(?![\\w:])', lambda m: 'store.' + m.group(1), content)

# Add the import statement just after the first import
lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('import '):
        lines.insert(i + 1, 'import { store } from "./state.js";')
        break

with open('app.js', 'w') as f:
    f.write('\n'.join(lines))
