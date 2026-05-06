const fs = require('fs');
const chatFile = 'src/app/api/chat/route.ts';
const siriFile = 'src/app/api/siri/route.ts';
let chatContent = fs.readFileSync(chatFile, 'utf8');
let siriContent = fs.readFileSync(siriFile, 'utf8');
chatContent = chatContent.replace("categoriesList.map(c => c.name)", "categoriesList.map((c: any) => c.name)");
siriContent = siriContent.replace("categoriesList.map(c => c.name)", "categoriesList.map((c: any) => c.name)");
fs.writeFileSync(chatFile, chatContent);
fs.writeFileSync(siriFile, siriContent);
