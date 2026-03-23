import re

with open('app.js', 'r') as f:
    code = f.read()

new_func = """async function fetchExpenses() {
    try {
        const response = await fetch(WEB_APP_URL);
        const result = await response.json();
        if (result.success) {
            // Map first to keep the original spreadsheet row numbers intact
            // Then filter out all the blank rows
            expenses = result.data
                .map((item, index) => ({...item, row: index + 2}))
                .filter(exp => exp.item && str_trim(exp.item) !== "" && exp.date !== "");
            renderDashboard();
            renderRecent();
        } else {
            alert("Failed to load data.");
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function str_trim(s) { return String(s).trim(); }
"""

# Find and replace the fetchExpenses function
pattern = r'async function fetchExpenses\(\)\s*\{.*?catch\s*\(error\)\s*\{.*?\n\s*\}\n\}'
code = re.sub(pattern, new_func, code, flags=re.DOTALL)

with open('app.js', 'w') as f:
    f.write(code)
