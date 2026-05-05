import os

def fix_dash():
    with open('src/components/DashboardTab.tsx', 'r') as f:
        c = f.read()
    c = c.replace('<div className="date-filter">', '<div className="date-filter" style={{ display: "flex", overflowX: "auto", gap: "10px", alignItems: "center", whiteSpace: "nowrap", paddingBottom: "4px" }}>')
    c = c.replace("return (Number(value) / 1000).toFixed(1) + 'K';", "return '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });")
    with open('src/components/DashboardTab.tsx', 'w') as f:
        f.write(c)

def fix_yearly():
    with open('src/components/YearlyTab.tsx', 'r') as f:
        c = f.read()
    c = c.replace("return '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);", "return '$' + (Number(value) / 1000).toFixed(1) + 'K';")
    c = c.replace("display: false,\n            callback: function", "display: true,\n            callback: function")
    with open('src/components/YearlyTab.tsx', 'w') as f:
        f.write(c)

def fix_chat():
    with open('src/components/ChatBox.tsx', 'r') as f:
        c = f.read()
    c = c.replace("background: 'var(--card-bg)'", "background: 'transparent'")
    c = c.replace('bg-black', '')
    c = c.replace('bg-gray-900', '')
    with open('src/components/ChatBox.tsx', 'w') as f:
        f.write(c)

fix_dash()
fix_yearly()
fix_chat()
