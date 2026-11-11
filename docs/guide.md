# Cascade guide

## The canvas
- **Drop a block.** Drag Loop, Question, Answer, Emotion, Consequence, Decision or Fog from the left onto the canvas
  (or tap one), type, press Enter. It flies to its place in the tree.
- **Ghost nodes** (dashed) are AI suggestions. Keep or dismiss each one, or use *Keep all* / *Dismiss all*.
- **Move** a node by dragging it onto another. **Edit** by double-clicking. **Collapse** with the chevron.
- **Delete** removes just that node and moves its children up. The branch button also removes everything below it.
  Delete / Backspace does the first, Shift+Delete the second. Undo reverses either.
- **Loops view** zooms out to the game-loop stages with a count and a strip of mood colours for each.
- **Emotion colour.** Colour is reserved for player feeling: frustration, boredom, curiosity, delight, awe,
  confusion, tension. Zoomed far out, the tree reads as a map of how the game feels.

## Growing and tracing
- After you drop a block it grows ghost branches in waves: answers, then follow-up questions and consequences, then
  emotions. The sparkle button grows any node on demand.
- Emotion blocks **trace back** instead: "why" questions about likely causes, linked to existing nodes.
- When the tree already has questions or answers, an emotion block is **bridged** instead: new questions grow from your existing nodes toward the feeling while the causes are traced back from it, and the two chains are linked where they meet. If they cannot meet, a grill starts on the missing step. You can also bridge from the Bridge button on any emotion block.
- Settings > Behavior controls auto-grow, auto trace-back and bridging, growth size and creativity.

## Goal and steering
Settings > Goal & steering. Write an overarching goal, optional game context, pillars and things to avoid, and choose
Light, Balanced or Strong steering. "What the AI is told" shows the exact text. The goal chip on the canvas shows the
current goal.

## Appearance and looks (Settings > Appearance)
The Appearance tab opens as a side sheet, so the canvas stays visible and updates as you change things.
Nothing changes until you change it: your edits are stored as overrides on top of the original design.

- **Presets** replace your current look with a ready-made one (Blueprint, Paper sketch, Neon night, Minimal mono,
  Soft pastel, Shape sampler). **Undo** brings the previous look back, and **Reset look** returns to the default.
- **Describe** takes a description in your own words, such as "dark and spacious with thin straight wires" or
  "big red decisions, small grey answers". With an AI connected it designs freely. Without one, a built-in keyword
  interpreter understands shapes, sizes, colours, wire styles, spacing, grid and the preset names. Either way you see
  what changed and choose **Keep it** or **Put it back**.
- **Blocks** edits one kind of block, or all of them. Per kind you can set shape (rounded, rect, pill, ellipse,
  diamond, hexagon, parallelogram, tag), fill, outline colour, width and style, text colour, size and weight, italic,
  width, padding, shadow, pattern, opacity, icon, a side bar and an outer ring. Width, text size and padding change
  the layout too. "Auto contrast" keeps text readable on any fill, and "Match mood" lets emotions follow the player
  feeling. **Mood colours** lets you redefine what each feeling looks like.
- **Wires** has four styles. *Default* is the original gentle curve. *Bezier* adds a curve slider. *Straight* draws
  direct lines. *Manhattan* routes with right angles and has elbow position and corner radius. You can also set wire
  width, colour, opacity, dash, arrowheads, colour wires by the block they lead to, and restyle related links, loop
  flow, blocking and trace-back wires on their own.
- **Canvas** sets the background, the grid (dots, lines, none), its colour and size, and the column and row spacing.
- **Text** shows everything you have changed as JSON. Edit it, paste one from a friend, or copy yours. Unknown or
  out-of-range values are ignored, so a bad paste cannot break the app.

Your look is saved in the browser. In the local app it is also saved in `settings.json`, so it follows you to any
browser you open Cascade in.

## Map and grill (Map button)
- **Map tab.** Destination (your goal), progress, and lists of *Up next*, *Waiting*, *Decisions so far*, *Fog* and
  *Out of scope*. Questions carry a ticket type (Talk, Prototype, Research, Task) and can block one another with the
  lock button. *Chart the map* drafts tickets, fog and blocking links against the destination.
- **Grill tab.** The AI asks a round of independent questions. You answer, it pushes back when an answer looks weak,
  and it never writes an answer for you. *I don't know* leaves a question open, *Needs a prototype* changes its
  ticket, *Out of scope* parks it. Three quick "yes" answers in a row earn a nudge.
- Settings lets you turn pushback off or ask one question at a time.

## Ask the graph (Ask button)
Type a question about your tree. The reply says whether the tree **answered**, **partly answered** or **can't answer**
it. Answering threads are highlighted in order with numbered badges and a flowing line, even across branches, while
everything else dims. Hide or show each thread, click a step to jump to it, add the missing questions the AI lists as
suggestions, and summarise either the highlighted threads or the whole tree. Without an AI it falls back to a keyword
match.

## Project folder (Settings > Project, local app)
Point Cascade at a game project and it learns from it. Scanning and searching happen on your computer.
- **Choose or paste a folder, then Scan.** You'll see the engine, how many files were read, a token estimate, the
  biggest folders, what was skipped and how many possible secrets were redacted. *Skip or add files* takes
  `.gitignore`-style patterns and extra file extensions.
- **Build brief.** Pick Quick, Standard or Thorough. Cascade shows the cost first, reads folder by folder, then writes a
  brief of what the project already does. Edit it freely: it is exactly what the AI is told. *Update brief* rereads only
  folders whose files changed, and *Restore previous brief* undoes a rebuild.
- **Use the brief in every AI call** and **let Ask and Grill cite files** are separate switches. The goal and pillars
  always take precedence over the brief.
- **Seed the graph** (also on the Map tab and the empty canvas) drafts ghost nodes: decisions already made, open
  questions, fog and loop stages. Each is tied to a file and line. Click the file mark on a node, or the *Where this came
  from* button, to read the code with the cited line highlighted.
- **Ask** shows a *From the tree / project files / both* tag, a list of what it read, and clickable citations. Turn the
  files off with *Also use the project's files*.
- **Grill** is shown the excerpts for the part of the tree you're working on, so it asks "is this intended?" about
  decisions the code already makes, and pushback can cite code that conflicts with your answer.
- Reading code needs a real AI. The demo can't do it.

## Local app: ports and quitting
- Starts at port 4173 and tries the next 50 if busy, then lets the OS choose. Starting it again from the same folder
  opens the copy already running instead of a second one.
- Ctrl+C, closing the terminal, or Settings > Data > *Quit Cascade now* all stop the server and release the port.
- Optional: *Stop Cascade when I close this tab*. A page reload does not count as closing.
- Data is saved next to the app as `tree.json` and `settings.json`. Set `CASCADE_DATA_DIR` to keep it elsewhere.
- Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `PORT`...) also work. See
  `.env.example`. Keys saved in Settings take priority.
