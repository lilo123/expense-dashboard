# STRICT UI CORRECTIONS - ATTEMPT 2

You failed to implement the previous UI fixes correctly. Do NOT invent new tasks. Do NOT touch the Bulk Edit logic. Fix exactly these three UI regressions introduced in your last update. Do not use sed:

1. **Chart Y-Axis Ruined (0.0K Bug):**
   - You applied the `/ 1000` K-formatting to the wrong chart (the horizontal "By Category" chart) and your math resulted in "0.0K" for everything.
   - Revert the "By Category" chart to its original formatting (exact exact dollar amounts).
   - Apply the `value / 1000` + 'K' logic ONLY to the vertical "Yearly" bar chart Y-axis. Ensure the math preserves one decimal place (e.g., $538 / 1000 = 0.5K, NOT 0.0K).

2. **Date Filter Layout Mangled:**
   - Your `flex-wrap: wrap` made the inputs and the "Clear" button stack awkwardly and look disproportionate.
   - Instead of a messy wrap, implement a clean CSS Grid layout for mobile (`grid-cols-[1fr_auto]` or similar) OR use a horizontal flex container with `overflow-x-auto` to allow smooth swiping, perfectly mirroring the legacy vanilla layout.

3. **AI Assistant Modal is Still Black:**
   - You claimed you fixed this, but the rectangular modal header is STILL solid black.
   - Locate the `bg-black`, `bg-gray-900`, or equivalent dark background class on the AI header container in `src/components/ChatBox.tsx` and REMOVE it. 
   - Ensure the spacing and colors exactly match the soft, integrated look of the legacy vanilla CSS.

Execute ONLY these three steps. Do not modify any other files.
