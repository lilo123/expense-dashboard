const fs = require('fs');
let ui = fs.readFileSync('ui.js', 'utf8');
ui = ui.replace(/modal\.style\.display === 'flex' \? 'none' : 'block'/g, "modal.style.display === 'flex' ? 'none' : 'flex'");
fs.writeFileSync('ui.js', ui);
