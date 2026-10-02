---
type: llm
criteria: "Did Pass 6 remove the AI tells while the structural and faithfulness rules survived?"
focus: output
---

Scoring:
- 2 points: ALL hold. (a) No em dash, "not just X, it's Y", "Let's dive in", "I hope this helps", "blazingly", "robust", "seamless", or "empowers". (b) The restart risk is a labeled **Warning:** or **Caution:** that stands before the Promote step. (c) Deploy and Promote are separate steps; **Promote** and **Releases** are bold UI labels. (d) "may drop in-flight requests" and "may be rolled back" keep "may" (or "can"/"might"). (e) Every instruction sentence is 20 words or fewer. (f) No invented step, command, or fact.
- 1 point: one of (a)-(f) fails.
- 0 points: two or more fail, or the warning label was flattened into prose.
