with open('styles.css', 'r') as f:
    lines = f.readlines()
with open('styles.css', 'w') as f:
    for line in lines:
        if 'position: absolute;' in line and 'bottom: 0; left: 0;' in line:
            continue
        if 'position: absolute;' in line and 'modal-content' in ''.join(lines):
            # A bit risky, let's just do targeted replace on the file text
            pass
