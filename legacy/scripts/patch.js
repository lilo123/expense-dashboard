const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
code = code.replace(/await supabase\./g, 'await supabaseClient.');
code = code.replace(/await supabase\r?\n/g, 'await supabaseClient\n');
const oldRegex = /async function signUp\(\)[\s\S]*?if \(data\.session\) showApp\(\);\s*\}\s*\}/;
const newCode = `async function signUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const msg = document.getElementById('signup-msg');
    
    if (!email || !password) {
        msg.innerText = "Please enter email and password.";
        return;
    }
    if (password !== confirmPassword) {
        msg.innerText = "Passwords do not match.";
        return;
    }
    msg.innerText = "Signing up...";
    
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        msg.innerText = error.message;
    } else {
        msg.innerText = "Account created! Adding default categories...";
        const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
        if (userId) {
            const defaults = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Housing', 'Other'];
            const inserts = defaults.map(name => ({ name, user_id: userId }));
            await supabaseClient.from('categories').insert(inserts);
        }
        msg.innerText = "Check your email to confirm, or you may be logged in!";
        if (data.session) {
            currentUser = data.session.user;
            showApp();
        }
    }
}`;
code = code.replace(oldRegex, newCode);
fs.writeFileSync('app.js', code);
console.log('Patched');