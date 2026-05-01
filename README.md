# AI_A6_23F-0774
# 🤖 Dynamic Wumpus Logic Agent 



##  Project Overview

This is a full-stack web application implementing a **Knowledge-Based Agent (KBA)** for the classic **Wumpus World** problem from AI. The agent:

1. Receives **percepts** (Breeze, Stench, Glitter) as it navigates a grid
2. **TELLs** its Knowledge Base propositional logic rules encoded in **CNF**
3. **ASKs** the KB whether adjacent cells are safe using automated **Resolution Refutation**
4. Only moves to cells it can **prove safe** — never guessing


---

##  Features

| Feature | Details |
|---|---|
| Dynamic Grid | User-configurable rows × cols (3×3 to 8×8) |
| Random Hazards | Pits and Wumpus placed randomly each episode |
| Propositional KB | Full CNF encoding of percept biconditionals |
| Resolution Refutation | Automated proof by contradiction |
| Real-Time Metrics | Inference steps, moves, exploration % |
| Step / Auto Mode | Manual step or continuous auto-play with speed control |
| Win/Lose Overlay | Full game-over screen with session statistics |
| Tactical HUD UI | Military amber terminal aesthetic |

---

##  Algorithm Deep-Dive

### Knowledge Base Encoding

When the agent visits cell `(r, c)` and perceives a **Breeze**, the following CNF clauses are added:

```
B_(r,c)  is TRUE                          → {B_(r,c)}
B_(r,c) ⇒ P_n1 ∨ P_n2 ∨ ... (adjacent)  → {P_n1, P_n2, ...}
```

When there is **no Breeze**:
```
¬B_(r,c) is TRUE                          → {¬B_(r,c)}
¬P_n1, ¬P_n2, ... for each neighbour     → {¬P_ni}  (unit clauses)
```

The same biconditional logic applies for **Stench ↔ Wumpus**.

### Resolution Refutation

To prove `¬P_(r,c)` (no pit at a cell), the algorithm:

1. Adds `P_(r,c)` (negation of query) to the KB
2. Iterates over all clause pairs, resolving complementary literals
3. If the **empty clause □** is derived → contradiction found → query **proven**
4. If no new clauses can be generated → query **cannot be proven**

```python
def resolution_refutation(kb_clauses, query_literal):
    clauses = set(kb_clauses) | {frozenset([query_literal.negate()])}
    while True:
        for (ci, cj) in combinations(clause_list, 2):
            resolvents = resolve(ci, cj)
            for r in resolvents:
                if len(r) == 0:
                    return True, steps, trace  # Proven!
                new.add(r)
        if new.issubset(clauses):
            return False, steps, trace         # Cannot prove
```

A cell is declared **safe** only if both `¬P_(r,c)` AND `¬W_(r,c)` are proven.

---

## 📁 Project Structure

```
AI_A6_23F-0774/
│
├── app.py              # Flask server & REST API endpoints
├── logic.py            # KB, Literal, Resolution engine, WumpusWorld
│
├── templates/
│   └── index.html      # Full single-page HTML
│
└── static/
    ├── style.css        
    └── script.js        # Grid rendering
```

---

## Running Locally

### Prerequisites
- Python 3.10+
- pip

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/AI_A6_23F-0774.git
cd AI_A6_23F-0774

# 2. Install dependencies
pip install flask

# 3. Run the server
python app.py

# 4. Open in browser
# http://127.0.0.1:5000
```

---

##  Deployment (Vercel)

### Step 1 — Add `vercel.json`

```json
{
  "builds": [
    { "src": "app.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "app.py" }
  ]
}
```

### Step 2 — Add `requirements.txt`

```
flask==2.3.3
```

### Step 3 — Deploy

```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## API Reference

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/` | GET | — | Serve the HTML frontend |
| `/api/new_game` | POST | `{rows, cols, pits}` | Initialize new episode |
| `/api/step` | POST | — | Advance agent one step |
| `/api/state` | GET | — | Get current game state |

### Example Response (`/api/step`)

```json
{
  "agent": [1, 0],
  "visited": [[0,0], [1,0]],
  "safe_confirmed": [[0,0], [1,0]],
  "percepts": ["Breeze"],
  "inference_steps": 8,
  "step_count": 2,
  "dead": false,
  "won": false,
  "kb_facts": ["TELL: ¬B_0_0  (no breeze)", "TELL: ¬P_1_0  (no breeze → no pit)"],
  "log": ["Agent at (1,0) | Percepts: ['Breeze']"],
  "grid": [...]
}
```

---



## Known Limitations

- Resolution engine uses a **complete but naive** clause-pair enumeration (exponential worst case)
- Agent uses a **greedy safe-first** strategy — does not backtrack optimally in large grids
- No arrow / Wumpus-kill mechanic (environment only)

---



