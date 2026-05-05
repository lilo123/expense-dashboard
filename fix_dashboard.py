import re

with open('src/components/DashboardTab.tsx', 'r') as f:
    content = f.read()

new_handleClear = '''  const handleClear = () => {
    setStartDate('');
    setEndDate('');
  };'''
content = re.sub(r'  const handleClear = \(\) => \{.*?\};', new_handleClear, content, flags=re.DOTALL)

new_div = '''<div className="flex flex-row items-stretch gap-2 w-full overflow-x-auto flex-nowrap mb-5 pb-2">
  <input type="month" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 min-w-[130px] h-[42px] px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:border-gray-400 shrink-0 box-border" />
  <span className="text-gray-500 font-medium shrink-0 flex items-center justify-center px-1">to</span>
  <input type="month" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 min-w-[130px] h-[42px] px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:border-gray-400 shrink-0 box-border" />
  <button type="button" onClick={handleClear} className="shrink-0 h-[42px] px-5 bg-[#f1f3f4] hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition-colors cursor-pointer flex items-center justify-center box-border">
    Clear
  </button>
</div>'''

content = re.sub(r'<div className="flex flex-row items-center gap-2 w-full overflow-x-auto whitespace-nowrap mb-5 pb-2">.*?</div>\n\n      <div className="summary-card total-card">', new_div + '\n\n      <div className="summary-card total-card">', content, flags=re.DOTALL)

with open('src/components/DashboardTab.tsx', 'w') as f:
    f.write(content)
