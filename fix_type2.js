const fs = require('fs');
const chatFile = 'src/app/api/chat/route.ts';
const siriFile = 'src/app/api/siri/route.ts';
let chatContent = fs.readFileSync(chatFile, 'utf8');
let siriContent = fs.readFileSync(siriFile, 'utf8');
chatContent = chatContent.replace(/categoriesList\.find\(c =>/g, "categoriesList.find((c: any) =>");
siriContent = siriContent.replace(/categoriesList\.find\(c =>/g, "categoriesList.find((c: any) =>");
fs.writeFileSync(chatFile, chatContent);
fs.writeFileSync(siriFile, siriContent);
