const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
let newFunc = `async function fetchExpenses() {
    try {
        const cached = localStorage.getItem('expense_data');
        if (cached) {
            expenses = JSON.parse(cached);
            renderDashboard();
            renderRecent();
        }
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        if (result.success) {
            expenses = result.data
                .map((item, index) => ({...item, row: index + 2}))
                .filter(exp => exp.item && str_trim(exp.item) !== '' && exp.date !== '');
            localStorage.setItem('expense_data', JSON.stringify(expenses));
            renderDashboard();
            renderRecent();
        }
    } catch (e) { console.error(e); }
}`;
code = code.replace(/async function fetchExpenses\(\) \{[\s\S]*?\}\n*function str_trim/, newFunc + '\n\nfunction str_trim');
fs.writeFileSync('app.js', code);
