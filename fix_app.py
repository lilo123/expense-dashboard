import re
with open('src/components/YearlyTab.tsx', 'r') as f:
    print("--- YearlyTab.tsx ---")
    content = f.read()
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'callbacks:' in line or 'toFixed' in line:
            print(f"{i+1}: {line}")
