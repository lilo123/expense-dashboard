const fs = require('fs');

// 1. Rewrite src/app/actions.ts
let actionsCode = fs.readFileSync('src/app/actions.ts', 'utf8');
// We need to ensure addExpenseAction, updateExpenseAction, bulkUpdateAction accept and pass the date correctly.
// The current actions already accept `date: string` and pass it to supabase. We just need to make sure we don't accidentally truncate it.
// Actually, actions.ts just passes `data.date` through. Let's verify if there are any .split('T')[0] in it.
if (actionsCode.includes(".split('T')[0]")) {
  actionsCode = actionsCode.replace(/\.split\('T'\)\[0\]/g, '');
  fs.writeFileSync('src/app/actions.ts', actionsCode);
}

// 2. Rewrite src/app/api/chat/route.ts
let routeCode = fs.readFileSync('src/app/api/chat/route.ts', 'utf8');
if (routeCode.includes(".split('T')[0]")) {
  routeCode = routeCode.replace(/\.split\('T'\)\[0\]/g, '');
  fs.writeFileSync('src/app/api/chat/route.ts', routeCode);
}

console.log('Backend route replacements complete');
