const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
const newFunc = `async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        if (result.success) {
            // Map first to keep the original spreadsheet row numbers intact
            // Then filter out all the blank rows
            expenses = result.data
                .map((item, index) => ({...item, row: index + 2}))
                .filter(exp => exp.item && String(exp.item).trim() !== \"\" && exp.date !== \"\");
            renderDashboard();
            renderRecent();
        } else {
            alert(\"Failed to load data.\");
        }
    } catch (error) {
        console.error(\"Error fetching data:\", error);
    }
}`;
code = code.replace(/async function fetchExpenses\(\)\s*\{[\s\S]*?catch\s*\(error\)\s*\{[\s\S]*?\n\s*\}\n\}/, newFunc);
fs.writeFileSync('app.js', code);
