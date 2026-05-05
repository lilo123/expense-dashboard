import re

with open('src/app/actions.ts', 'r') as f:
    content = f.read()

pattern = re.compile(r"(export async function addCategoryAction.*?)(\s+if \(error\) \{\n\s+return \{ success: false, error: error\.message \}\n\s+\})", re.DOTALL)

def repl(match):
    return match.group(1) + """  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists. Please choose a different name.' }
    }
    return { success: false, error: error.message }
  }"""

new_content = pattern.sub(repl, content, count=1)

with open('src/app/actions.ts', 'w') as f:
    f.write(new_content)
