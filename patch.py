with open('app.js', 'r') as f:
    code = f.read()

code = code.replace('await supabase.', 'await supabaseClient.')
code = code.replace('await supabase\\n', 'await supabaseClient\\n')

start = code.find('async function signUp()')
end = code.find('async function signOut()', start)

new_func = """async function signUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    const msg = document.getElementById('signup-msg');
    
    if (!email || !password) {
        msg.innerText = \"Please enter email and password.\";
        return;
    }
    if (password !== confirmPassword) {
        msg.innerText = \"Passwords do not match.\";
        return;
    }
    msg.innerText = \"Signing up...\";
    
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        msg.innerText = error.message;
    } else {
        msg.innerText = \"Account created! Adding default categories...\";
        const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
        if (userId) {
            const defaults = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Housing', 'Other'];
            const inserts = defaults.map(name => ({ name: name, user_id: userId }));
            await supabaseClient.from('categories').insert(inserts);
        }
        msg.innerText = \"Check your email to confirm, or you may be logged in!\";
        if (data.session) {
            currentUser = data.session.user;
            showApp();
        }
    }
}

"""
if start != -1 and end != -1:
    code = code[:start] + new_func + code[end:]
    with open('app.js', 'w') as f:
        f.write(code)
    print('Patched app.js')
else:
    print('Could not find functions')
