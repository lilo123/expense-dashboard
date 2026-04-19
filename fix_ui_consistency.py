import re

# 1. Update CSS Variables
with open('styles.css', 'r') as f:
    css = f.read()

if '--text-muted' not in css:
    css = css.replace('--text: #000000;', '--text: #000000;\n    --text-muted: #8e8e93;')

with open('styles.css', 'w') as f:
    f.write(css)

# 2. Update HTML Colors and Emojis
with open('index.html', 'r') as f:
    html = f.read()

# Fix undefined --primary by mapping to --accent
html = html.replace('var(--primary)', 'var(--accent)')

# Replace hardcoded blues and greys with consistent theme variables
html = html.replace('#1a73e8', 'var(--accent)')
html = html.replace('#ccc', 'var(--border)')
html = html.replace('background-color: #fff', 'background-color: var(--bg)')
html = html.replace('#5f6368', 'var(--text-muted)')

# Replace lingering messed up Siri emoji and Folder emoji with sleek SVGs
MIC_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: text-bottom;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>'
FOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: text-bottom;"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>'

html = re.sub(r'🎙️?[^<a-zA-Z]*Siri Setup', f'{MIC_SVG} Siri Setup', html)
html = re.sub(r'📁', FOLDER_SVG, html)

with open('index.html', 'w') as f:
    f.write(html)

# Also check app.js for emojis just in case
with open('app.js', 'r') as f:
    app_js = f.read()
app_js = re.sub(r'📁', FOLDER_SVG, app_js)
with open('app.js', 'w') as f:
    f.write(app_js)

print("UI consistency fixes applied.")
