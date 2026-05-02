const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');
js = js.replace("options: {", "options: { indexAxis: 'y', maintainAspectRatio: false,");
js = js.replace("const ctx = document.getElementById('expenseChart').getContext('2d');", "document.querySelector('.chart-container').style.height = Math.max(300, labels.length * 40 + 50) + 'px';\n    const ctx = document.getElementById('expenseChart').getContext('2d');");
fs.writeFileSync('app.js', js);
let css = fs.readFileSync('styles.css', 'utf8');
css = css.replace(".chart-container { background", ".chart-container { position: relative; width: 100%; box-sizing: border-box; background");
fs.writeFileSync('styles.css', css);
