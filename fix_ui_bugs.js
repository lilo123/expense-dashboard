const fs = require('fs');

function updateFile(file, replacer) {
  const content = fs.readFileSync(file, 'utf8');
  const newContent = replacer(content);
  fs.writeFileSync(file, newContent);
}

updateFile('src/app/globals.css', content => {
  return content.replace(
    '.date-filter { display: flex; align-items: center; margin-bottom: 20px; gap: 8px; }',
    '.date-filter { display: flex; align-items: center; margin-bottom: 20px; gap: 8px; flex-wrap: wrap; }'
  );
});

updateFile('src/components/ChatBox.tsx', content => {
  let res = content.replace(
    "padding: '20px', background: 'var(--accent)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'",
    "padding: '15px 20px', background: 'var(--card-bg)', color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)'"
  );
  res = res.replace(
    "background: 'rgba(255,255,255,0.2)', color: 'white'",
    "background: 'transparent', color: 'var(--text)'"
  );
  return res;
});

updateFile('src/components/DashboardTab.tsx', content => {
  return content.replace(
    "y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold' as const, size: 14 }, color: '#000' } }",
    "y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold' as const, size: 14 }, color: '#000', callback: function(value: any) { return (Number(value) / 1000).toFixed(1) + 'K'; } } }"
  );
});

updateFile('src/components/ClientDashboard.tsx', content => {
  let res = content.replace(/bottom:\s*'140px',\s*/g, '');
  res = res.replace(/bottom:\s*'80px',\\s*/g, '');
  return res;
});


console.log("Fixes applied successfully.");
