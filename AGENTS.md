<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. NO Reward Hacking

DO NOT Simplify the task merely in order to declare victory earlier. NEVER fake or
instrument a part of the system in order to make it easier to implement some complex requirement, unless the user
asks for this explicitly (You can do this as part of an iterative design process, but make sure you have
communicated this to the user, and let him know the task is not finished). Do not build a fake subsystem that mocks
a component as a fallback for when the actual subsystem fails (e.g. a fallback system that generates synthetic data).

## IMPORTANT Python style guide

**Never use `except Exception as e:` by default**

Almost always you should instead fail fast and let the exception blow up. If
you really think you need a broad except catch like this you MUST ASK THE USER
for approval. But this should be very rare.

## Project specific

* Never run a python file with `python3`, it won't work. use `blaze build` or `blaze run`
* GChat: You have a gchat skill at
  `google3/learning/gemini/agents/skills/gchat/SKILL.md`. Use
  `/google/bin/releases/gemini-agents-gchat/gchat` to read/send Google Chat
  messages. Extract space ID from chat URLs (e.g.,
  `https://chat.google.com/room/SPACE_ID/THREAD/...`). When posting a message in GChat, always prefix the message with `🤖 jetski `.
* To read google docs, ALWAYS use learning/gemini/agents/skills/gdocs/SKILL.md.
  NEVER use anything else
