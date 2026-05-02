import re

with open('app.js', 'r') as f:
    content = f.read()

# Fix 1: Yearly chart years extraction
content = re.sub(
    r'const d = new Date\(exp\.date\);\n\s*if \(\!isNaN\(d\.getTime\(\)\)\) years\.add\(d\.getFullYear\(\)\.toString\(\)\);',
    r'const d = new Date(exp.date);\n        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());\n        if (!isNaN(d.getTime())) years.add(d.getFullYear().toString());',
    content
)

# Fix 2: Yearly chart months extraction
content = re.sub(
    r'const d = new Date\(exp\.date\);\n\s*if \(isNaN\(d\.getTime\(\)\) \|\| d\.getFullYear\(\)\.toString\(\) !== selectedYear\) return;',
    r'const d = new Date(exp.date);\n        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());\n        if (isNaN(d.getTime()) || d.getFullYear().toString() !== selectedYear) return;',
    content
)

# Fix 3: Yearly details month extraction
content = re.sub(
    r'const dateObj = new Date\(exp\.date\);\n\s*if \(isNaN\(dateObj\.getTime\(\)\)\) return false;',
    r'const dateObj = new Date(exp.date);\n        dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());\n        if (isNaN(dateObj.getTime())) return false;',
    content
)

with open('app.js', 'w') as f:
    f.write(content)

print("Done")
