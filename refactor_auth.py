import os

with open('index.html', 'r') as f:
    html = f.read()

old_auth = """<div id="auth-overlay" class="auth-overlay">
        <div class="auth-card" id="signin-card">
            <h2>Welcome Back</h2>
            <p>Please sign in to manage your expenses.</p>
            <form id="signin-form">
            <input type="email" id="signin-email" placeholder="Email Address" required>
            <input type="password" id="signin-password" placeholder="Password" required>
            <div class="auth-buttons">
                <button type="submit" id="signin-btn" style="width: 100%;">Sign In</button>
            </div>
        </form>
            <p style="margin-top: 15px; font-size: 0.9em; text-align: center;">
                Don't have an account? <a href="#" id="toggle-to-signup" style="color: var(--primary); text-decoration: none; font-weight: bold;">Sign up here</a>
            </p>
            <p id="signin-message" class="auth-message"></p>
        </div>

        <div class="auth-card" id="signup-card" style="display: none;">
            <h2>Create Account</h2>
            <p>Sign up to start tracking your expenses.</p>
            <form id="signup-form">
            <input type="email" id="signup-email" placeholder="Email Address" required>
            <input type="password" id="signup-password" placeholder="Password" required>
            <input type="password" id="signup-confirm-password" placeholder="Confirm Password" required>
            <div class="auth-buttons">
                <button type="submit" id="signup-btn" style="width: 100%;">Create Account</button>
            </div>
        </form>
            <p style="margin-top: 15px; font-size: 0.9em; text-align: center;">
                Already have an account? <a href="#" id="toggle-to-signin" style="color: var(--primary); text-decoration: none; font-weight: bold;">Sign in here</a>
            </p>
            <p id="signup-message" class="auth-message"></p>
        </div>
    </div>"""

new_auth = """<div id="auth-overlay" class="auth-overlay">
        <div class="auth-card" id="signin-card">
            <h2>Welcome Back</h2>
            <p>Please sign in to manage your expenses.</p>
            <form id="signin-form">
                <div class="input-group">
                    <input type="email" id="signin-email" placeholder="Email Address" autocomplete="email" inputmode="email" required>
                </div>
                <div class="input-group password-group">
                    <input type="password" id="signin-password" placeholder="Password" autocomplete="current-password" required>
                    <button type="button" class="toggle-password" onclick="window.togglePasswordVisibility('signin-password', this)">👁️</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 0.9em;">
                    <label style="display: flex; align-items: center; cursor: pointer; color: var(--text);">
                        <input type="checkbox" id="remember-me" checked style="width: auto; margin: 0 5px 0 0; accent-color: var(--primary);"> Remember me
                    </label>
                    <a href="#" style="color: var(--primary); text-decoration: none;">Forgot Password?</a>
                </div>
                <div class="auth-buttons">
                    <button type="submit" id="signin-btn" style="width: 100%;">Sign In</button>
                </div>
            </form>
            <p style="margin-top: 15px; font-size: 0.9em; text-align: center;">
                Don't have an account? <a href="#" id="toggle-to-signup" style="color: var(--primary); text-decoration: none; font-weight: bold;">Sign up here</a>
            </p>
            <p id="signin-message" class="auth-message"></p>
        </div>

        <div class="auth-card" id="signup-card" style="display: none;">
            <h2>Create Account</h2>
            <p>Sign up to start tracking your expenses.</p>
            <form id="signup-form">
                <div class="input-group">
                    <input type="email" id="signup-email" placeholder="Email Address" autocomplete="email" inputmode="email" required>
                </div>
                <div class="input-group password-group">
                    <input type="password" id="signup-password" placeholder="Password" autocomplete="new-password" required>
                    <button type="button" class="toggle-password" onclick="window.togglePasswordVisibility('signup-password', this)">👁️</button>
                </div>
                <div class="input-group password-group">
                    <input type="password" id="signup-confirm-password" placeholder="Confirm Password" autocomplete="new-password" required>
                    <button type="button" class="toggle-password" onclick="window.togglePasswordVisibility('signup-confirm-password', this)">👁️</button>
                </div>
                <div class="auth-buttons">
                    <button type="submit" id="signup-btn" style="width: 100%;">Create Account</button>
                </div>
            </form>
            <p style="margin-top: 15px; font-size: 0.9em; text-align: center;">
                Already have an account? <a href="#" id="toggle-to-signin" style="color: var(--primary); text-decoration: none; font-weight: bold;">Sign in here</a>
            </p>
            <p id="signup-message" class="auth-message"></p>
        </div>
    </div>"""

if '<div id="auth-overlay" class="auth-overlay">' in html:
    # Using replace since multiline strings can be tricky, let's just do a simple string replace
    html = html.replace(old_auth, new_auth)
    
    script_block = """<script>
        window.togglePasswordVisibility = function(inputId, button) {
            const input = document.getElementById(inputId);
            if (input.type === 'password') {
                input.type = 'text';
                button.textContent = '🙈';
            } else {
                input.type = 'password';
                button.textContent = '👁️';
            }
        };
    </script>
</body>"""
    if 'togglePasswordVisibility' not in html:
        html = html.replace('</body>', script_block)
        
    with open('index.html', 'w') as f:
        f.write(html)
    print('Updated index.html')
else:
    print('Could not find auth-overlay block exactly as expected')

with open('styles.css', 'r') as f:
    css = f.read()

if '.input-group' not in css:
    css += """
/* Auth UX Updates */
.input-group {
    position: relative;
    margin-bottom: 15px;
}
.input-group input {
    margin-bottom: 0 !important;
    width: 100%;
    padding-right: 40px !important;
}
.password-group .toggle-password {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    color: #666;
    padding: 0;
}
"""
    with open('styles.css', 'w') as f:
        f.write(css)
    print('Updated styles.css')
