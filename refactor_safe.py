import os
import re

with open('index.html', 'r') as f:
    html = f.read()

listeners = []
counter = 1

def process_tag_str(tag_str):
    global counter
    if not re.search(r'\son[a-z]+="[^"]+"', tag_str):
        return tag_str
        
    on_attrs = re.findall(r'\s(on[a-z]+)="([^"]+)"', tag_str)
    if not on_attrs:
        return tag_str
        
    id_match = re.search(r'\sid="([^"]+)"', tag_str)
    if id_match:
        element_id = id_match.group(1)
    else:
        element_id = f"action-elem-{counter}"
        counter += 1
        parts = tag_str.split(' ', 1)
        if len(parts) > 1:
            tag_str = f"{parts[0]} id=\"{element_id}\" {parts[1]}"
            
    new_tag = tag_str
    for attr, handler in on_attrs:
        new_tag = re.sub(rf'\s{attr}="{re.escape(handler)}"', '', new_tag)
        event_type = attr[2:]
        var_name = element_id.replace('-', '_')
        if "handleChatKeyPress(event)" in handler:
            listeners.append(f"    const el_{var_name} = document.getElementById('{element_id}');\n    if (el_{var_name}) el_{var_name}.addEventListener('{event_type}', handleChatKeyPress);")
        else:
            listeners.append(f"    const el_{var_name} = document.getElementById('{element_id}');\n    if (el_{var_name}) el_{var_name}.addEventListener('{event_type}', (e) => {{ {handler} }});")
            
    return new_tag

new_html = ""
i = 0
while i < len(html):
    if html[i] == '<' and i+1 < len(html) and html[i+1].isalpha():
        end = html.find('>', i)
        if end != -1:
            tag_str = html[i:end+1]
            new_html += process_tag_str(tag_str)
            i = end + 1
            continue
    new_html += html[i]
    i += 1

with open('index_refactored.html', 'w') as f:
    f.write(new_html)

js_code = "\n// --- EVENT LISTENERS (Best Practice Refactor) ---\n"
js_code += "document.addEventListener('DOMContentLoaded', () => {\n"
js_code += "\n".join(listeners)
js_code += "\n});\n"

with open('events_refactored.js', 'w') as f:
    f.write(js_code)

print("Done preparing files")
