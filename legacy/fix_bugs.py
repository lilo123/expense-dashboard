import re

# 1. Fix CSS for mobile modals
with open('styles.css', 'r') as f:
    css = f.read()

# Remove flex-end alignments for .modal on mobile
css = re.sub(r'align-items:\s*flex-end\s*!important;', 'align-items: center !important;', css)
# We can also just remove the bottom-left positioning remnants
css = re.sub(r'border-radius:\s*20px 20px 0 0\s*!important;', 'border-radius: 16px !important;', css)

with open('styles.css', 'w') as f:
    f.write(css)

# 2. Fix JS for modal closing
with open('events_refactored.js', 'r') as f:
    js = f.read()

# Add stopPropagation to modal close buttons to prevent bubbling issues
js = js.replace('(e) => { toggleCategoryModal() }', '(e) => { e.stopPropagation(); toggleCategoryModal(); }')

with open('events_refactored.js', 'w') as f:
    f.write(js)
