const fs = require('fs');
const file = 'app.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
/const d = new Date\(exp\.date\);\n        if \(\!isNaN\(d\.getTime\(\)\)\) years\.add\(d\.getFullYear\(\)\.toString\(\)\);/g,
`const d = new Date(exp.date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (!isNaN(d.getTime())) years.add(d.getFullYear().toString());`
);

code = code.replace(
/const d = new Date\(exp\.date\);\n        if \(isNaN\(d\.getTime\(\)\) \|\| d\.getFullYear\(\)\.toString\(\) !== selectedYear\) return;/g,
`const d = new Date(exp.date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (isNaN(d.getTime()) || d.getFullYear().toString() !== selectedYear) return;`
);

code = code.replace(
/const dateObj = new Date\(exp\.date\);\n        if \(isNaN\(dateObj\.getTime\(\)\)\) return false;/g,
`const dateObj = new Date(exp.date);
        dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
        if (isNaN(dateObj.getTime())) return false;`
);

fs.writeFileSync(file, code);
console.log('Fixed timezones in app.js');
