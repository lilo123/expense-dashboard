const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Imports
code = code.replace(/import \{ supabaseClient \} from \"\.\/api\.js\";/, 'import { authService, categoryService, expenseService, tokenService } from "./services.js";');

// 2. Auth
code = code.replace(/supabaseClient\.auth\.getSession\(\)/g, 'authService.getSession()');
code = code.replace(/supabaseClient\.auth\.onAuthStateChange/g, 'authService.onAuthStateChange');
code = code.replace(/supabaseClient\.auth\.signInWithPassword\(\{ email, password \}\)/g, 'authService.signIn(email, password)');
code = code.replace(/supabaseClient\.auth\.signUp\(\{ email, password \}\)/g, 'authService.signUp(email, password)');
code = code.replace(/supabaseClient\.auth\.signOut\(\)/g, 'authService.signOut()');

// 3. Categories
code = code.replace(/await supabaseClient\.from\('categories'\)\.insert\(inserts\);/g, 'await categoryService.createDefaults(userId, defaults);');
code = code.replace(/await supabaseClient\s*\.from\('categories'\)\s*\.select\('\*'\)\s*\.eq\('user_id', store\.currentUser\.id\)\s*\.order\('name', \{ ascending: true \}\)/g, 'await categoryService.fetchAll(store.currentUser.id)');
code = code.replace(/await supabaseClient\s*\.from\('categories'\)\s*\.insert\(\[\{ name: name, user_id: store\.currentUser\.id \}\]\)/g, 'await categoryService.add(store.currentUser.id, name)');
code = code.replace(/await supabaseClient\s*\.from\('categories'\)\s*\.update\(\{ name: trimmedName \}\)\s*\.eq\('id', id\)/g, 'await categoryService.update(id, trimmedName)');
code = code.replace(/await supabaseClient\s*\.from\('categories'\)\s*\.delete\(\)\s*\.eq\('id', id\)/g, 'await categoryService.delete(id)');

// 4. Expenses
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.update\(\{ category: trimmedName \}\)\s*\.eq\('user_id', store\.currentUser\.id\)\s*\.eq\('category', oldName\)/g, 'await expenseService.updateCategoryName(store.currentUser.id, oldName, trimmedName)');
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.select\('\*'\)\s*\.eq\('user_id', store\.currentUser\.id\)\s*\.order\('date', \{ ascending: false \}\)/g, 'await expenseService.fetchAll(store.currentUser.id)');
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.insert\(\[\{\s*user_id: store\.currentUser\.id,\s*date: date,\s*item: item,\s*amount: amount,\s*category: category\s*\}\]\)/g, 'await expenseService.add(store.currentUser.id, date, item, amount, category)');
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.update\(\{ item, amount, category, date \}\)\s*\.eq\('id', id\)/g, 'await expenseService.update(id, item, amount, category, date)');
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.delete\(\)\s*\.eq\('id', id\)/g, 'await expenseService.delete(id)');
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.delete\(\)\s*\.in\('id', idsToDelete\)/g, 'await expenseService.deleteBulk(idsToDelete)');
code = code.replace(/await supabaseClient\.from\('expenses'\)\.insert\(insertPayload\)/g, 'await expenseService.add(insertPayload.user_id, insertPayload.date, insertPayload.item, insertPayload.amount, insertPayload.category)');
code = code.replace(/await supabaseClient\s*\.from\('expenses'\)\s*\.update\(updates\)\s*\.in\('id', idsToEdit\)/g, 'await expenseService.updateBulk(idsToEdit, updates)');

// 5. Tokens
code = code.replace(/await supabaseClient\s*\.from\('api_tokens'\)\s*\.select\('token'\)\s*\.eq\('user_id', user\.id\)\s*\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(1\)/g, 'await tokenService.fetchLatest(user.id)');
code = code.replace(/await supabaseClient\s*\.from\('api_tokens'\)\s*\.insert\(\[\s*\{ user_id: user\.id, token: token \}\s*\]\)/g, 'await tokenService.create(user.id, token)');

fs.writeFileSync('app.js', code);
console.log("Refactoring complete.");
