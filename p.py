import re
with open('app.js','r') as f: c=f.read()
c=c.replace('await supabase.','await supabaseClient.')
c=c.replace('await supabase\n','await supabaseClient\n')
ns='''async function signUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const msg = document.getElementById('signup-msg');
    if (!email || !password) { msg.innerText = "Please enter email and password."; return; }
    if (password !== confirmPassword) { msg.innerText = "Passwords do not match."; return; }
    msg.innerText = "Signing up...";
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { msg.innerText = error.message; } else {
        msg.innerText = "Account created! Adding default categories...";
        const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
        if (userId) {
            const defaults = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Housing', 'Other'];
            const inserts = defaults.map(name => ({ name, user_id: userId }));
            await supabaseClient.from('categories').insert(inserts);
        }
        msg.innerText = "Check your email to confirm!";
        if (data.session) { currentUser = data.session.user; showApp(); }
    }
}'''
p=re.compile(r'async function signUp\(\)\s*\{.*?if \(data\.session\) showApp\();\s*\}\s*\}',re.DOTALL)
c=p.sub(ns,c)
with open('app.js','w') as f: f.write(c)
print("Done")