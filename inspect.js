const fs = require('fs');
function showMatch(file, regex) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(regex);
    console.log(`--- ${file} ---`);
    if (match) console.log(match[0]);
    else console.log('Not found');
  } catch (e) { console.log(`Error reading ${file}`); }
}

showMatch('src/components/DashboardTab.tsx', /const options = \{[\s\S]*?y:\s*\{[\s\S]*?ticks:\s*\{[\s\S]*?\}[\s\S]*?\}[\s\S]*?\};/);
showMatch('src/components/DashboardTab.tsx', /<div[^>]*date-filter[^>]*>[\s\S]*?<\/div>/);
showMatch('src/components/YearlyTab.tsx', /const options = \{[\s\S]*?y:\s*\{[\s\S]*?ticks:\s*\{[\s\S]*?\}[\s\S]*?\}[\s\S]*?\};/);
showMatch('src/components/ChatBox.tsx', /<div[^>]*className=["'][^"']*?(bg-black|bg-gray-900|bg-\[#111\]|header)[^"']*?["'][^>]*>/i);
