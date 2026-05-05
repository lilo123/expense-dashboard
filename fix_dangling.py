import sys

with open('src/components/DashboardTab.tsx', 'r') as f:
    content = f.read()

bad_chunk = '''</div>\n  <button onClick={handleClear} className="w-full sm:w-auto shrink-0 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 transition-colors cursor-pointer shadow-sm">\n    Clear\n  </button>\n</div>'''

if bad_chunk in content:
    content_new = content.replace(bad_chunk, '</div>')
    with open('src/components/DashboardTab.tsx', 'w') as f:
        f.write(content_new)
    print("Successfully removed dangling markup.")
else:
    print("Could not find the dangling markup chunk.")
