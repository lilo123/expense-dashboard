const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
const funcs = ['showAuth', 'toggleAuth', 'toggleCategoryModal', 'toggleSelectMode', 'closeEditModal', 'toggleAddModal', 'toggleChatModal', 'openBulkEditModal', 'closeBulkEditModal', 'toggleSiriModal', 'escapeHtml'];
let uiCode = '';
for (let fn of funcs) {
  let start = code.indexOf('function ' + fn + '(');
  if (start === -1) start = code.indexOf('function ' + fn + ' (');
  if (start !== -1) {
    let count = 0, i = start, started = false;
    while (i < code.length) {
      if (code[i] === '{') { count++; started = true; }
      if (code[i] === '}') { count--; }
      i++;
      if (started && count === 0) {
        uiCode += 'export ' + code.substring(start, i) + '\n\n';
        code = code.substring(0, start) + code.substring(i);
        break;
      }
    }
  }
}
fs.writeFileSync('ui.js', uiCode);
fs.writeFileSync('app.js', code);
console.log('Extracted UI functions. ui.js created.');
