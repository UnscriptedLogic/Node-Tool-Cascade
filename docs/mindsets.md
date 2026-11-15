# Mindsets

Open **Settings > Mindsets** to import a JSON pack or paste JSON. Download the example there to start your own. You can import several packs, enable each for this Cascade, change its icon, or export it.

## Included lenses

**Enable starter mindset** adds eight selected Jesse Schell lenses to this Cascade. Names and numbers follow the linked **2008 edition**; questions use original wording. This is a starter selection, not the complete book or its question lists. It works only in **Game design**. Example node: “Why does traversal stop feeling like discovery?” Apply the starter to that node to explore it through a relevant lens.

## Convert a book or other material

1. Open **Create a mindset from source material**.
2. Upload PDF, TXT, Markdown, HTML, JSON, CSV, TSV, XML or YAML, or paste text. For a web page, save its HTML or paste its article text; the optional source link records attribution without downloading the page.
3. Name the pack, record its source and edition, and choose allowed domains. A business framework should use General / business; game lenses should use Game design.
4. Check the displayed number of provider calls, then choose **Generate draft**. Extraction stays on this device; generation sends extracted text to your selected provider in chunks. A local model keeps the whole workflow on your computer.
5. Review each concept, question, topic trigger and page/line reference. Edit the JSON if needed, then **Import reviewed draft** or **Download JSON**. Generation alone never enables a pack.

The converter turns supported approaches into reusable questions rather than copying source question lists. It checks short evidence passages against the input, then leaves those passages out of the JSON. Repeated concepts merge. Lens numbers are kept only when supported by a nearby source heading. References point to the source sections inspected for that entry.

Progress distinguishes a complete pass over extracted text from a partial conversion. Stop, provider errors, and the entry limit preserve any useful partial draft. A complete pass does not guarantee every idea was captured; review is still needed. Raw source text is not saved in the tree or pack.

Limits: eight files at once, 25 MB each, 1,000 pages per PDF, 2 million extracted characters total, and 200 entries per draft. Scans need OCR first; unreadable/blank pages are reported. Images, audio and Word files need a PDF or text export. Encrypted or malformed PDFs may require an unlocked/repaired copy. For long books, consider converting focused chapters into separate packs.

PDF reading uses a bundled browser reader. Local PDF imports require `npm install` and a current browser; hosted builds include the reader. Other app features still run without installing dependencies.

Select a node and choose **Apply a mindset** to request up to three questions from a matching pack. Growing branches, tracing, bridging, charting and interviews can also include up to two mindset questions alongside ordinary questions. A connected provider is required; demo responses do not use imported packs.

Questions keep normal answer, resolution and blocker behavior. Their header shows the mindset or lens name and number. Click or tap the header for its source and relevance explanation. Removing a pack keeps existing questions and their source labels. Packs travel with saved Cascades and tree exports. New Cascades start without packs.

## Pack format

```json
{
  "schemaVersion": 1,
  "id": "assumption-checks",
  "version": "1.0.0",
  "name": "Assumption checks",
  "icon": "💡",
  "domains": ["general", "product", "research", "game"],
  "source": { "title": "My workshop notes", "edition": "2026" },
  "guidance": "Expose assumptions and ask how to test them.",
  "entries": [{
    "id": "evidence",
    "name": "Evidence",
    "label": "Lens",
    "number": "1",
    "topics": ["budget", "pricing", "risk"],
    "appliesWhen": "A decision depends on an uncertain estimate.",
    "questions": ["What evidence supports this assumption?"]
  }]
}
```

- `schemaVersion`, `id`, `name`, `domains` and `entries` are required. Each entry needs a unique `id`, `name`, `topics` and `questions`. IDs use letters, numbers, dots, underscores or hyphens. Other fields are optional; icon defaults to 💡 and label to Lens.
- Optional `source.url` and `source.coverage` record the reference and conversion scope. Each entry may have `references: [{"source":"book.pdf","location":"PDF page 51"}]`; node source details preserve these after the original pack is removed.
- Domains are explicit: `general`, `product`, `research`, `game`. Entry `domains` can narrow its pack's domains. A game-only pack is never offered to generation in General, Product or Research.
- Topics are whole words or phrases, case insensitive. Include useful variants, such as `risk` and `risks`. Cascade checks the selected node and up to two ancestors; whole-tree interviews use the goal, context and first 20 accepted nodes. Topic matching shortlists entries; the model must still judge meaning and skip irrelevant lenses.
- Set narrow domains and topics. For Jesse Schell lenses, use `domains: ["game"]` and supply the lens names, numbers, questions and edition from your reference. Cascade does not supply or guess the book's lens collection.
- Import one pack or an array. Limits: 12 packs per Cascade, 200 entries per pack, 30 topics and 12 questions per entry, 500 KB per file. Duplicate pack IDs are rejected; remove an old pack before importing its replacement.

Topic matching is conservative: a relevant lens may be skipped if its keywords are absent. Model relevance judgments can still be imperfect; generated questions remain suggestions to keep or dismiss.
