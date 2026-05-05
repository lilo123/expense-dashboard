import sys
import re

with open('src/components/DashboardTab.tsx', 'r') as f:
    content = f.read()

# Try to find the block starting from <div className="flex flex-col sm:flex-row...
# down to the closing div of that block.

pattern = re.compile(r'<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full mb-6 p-1">.*?</div>\n', re.DOTALL)

new_block = '''<div className="flex flex-row items-center gap-2 w-full overflow-x-auto whitespace-nowrap mb-5 pb-2">
  <input type="month" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 min-w-[130px] p-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:border-gray-400 shrink-0" />
  <span className="text-gray-500 font-medium shrink-0">to</span>
  <input type="month" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 min-w-[130px] p-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:border-gray-400 shrink-0" />
  <button onClick={handleClear} className="shrink-0 px-4 py-2.5 bg-[#f1f3f4] hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition-colors cursor-pointer">
    Clear
  </button>
</div>
'''

content_new = pattern.sub(new_block, content, count=1)

if content_new != content:
    with open('src/components/DashboardTab.tsx', 'w') as f:
        f.write(content_new)
    print("Successfully updated layout.")
else:
    print("Could not find the block to replace.")
