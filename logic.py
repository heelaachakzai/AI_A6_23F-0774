import random
from itertools import combinations


#  Propositional Logic helpers


class Literal:
    """A signed propositional variable, e.g. P_1_1 or ¬P_1_1."""
    def __init__(self, name: str, negated: bool = False):
        self.name = name
        self.negated = negated

    def negate(self):
        return Literal(self.name, not self.negated)

    def __eq__(self, other):
        return self.name == other.name and self.negated == other.negated

    def __hash__(self):
        return hash((self.name, self.negated))

    def __repr__(self):
        return f"{'¬' if self.negated else ''}{self.name}"


def resolve(c1: frozenset, c2: frozenset):
    """
    Attempt to resolve two clauses.
    Returns a set of resolvents (each a frozenset of Literals).
    Returns None if no complementary pair exists.
    """
    resolvents = []
    for lit in c1:
        neg = lit.negate()
        if neg in c2:
            new_clause = (c1 - {lit}) | (c2 - {neg})
            resolvents.append(frozenset(new_clause))
    return resolvents if resolvents else None


def resolution_refutation(kb_clauses: list, query_literal: Literal):
    """
    Prove 'query_literal' by refutation:
      Add ¬query_literal to KB, try to derive the empty clause.
    Returns (proved: bool, steps: int, trace: list[str])
    """
    clauses = set(kb_clauses)
    negated_query = frozenset([query_literal.negate()])
    clauses.add(negated_query)

    steps = 0
    trace = []
    new = set()
    clause_list = list(clauses)

    while True:
        pairs = list(combinations(clause_list, 2))
        for (ci, cj) in pairs:
            resolvents = resolve(ci, cj)
            if resolvents is None:
                continue
            for r in resolvents:
                steps += 1
                trace.append(
                    f"Step {steps}: Resolve {_fmt(ci)} + {_fmt(cj)} → {_fmt(r)}"
                )
                if len(r) == 0:          # empty clause → contradiction found
                    return True, steps, trace
                new.add(r)

        if new.issubset(clauses):
            return False, steps, trace   # no new clauses → cannot prove

        for c in new:
            if c not in clauses:
                clause_list.append(c)
        clauses |= new


def _fmt(clause):
    if not clause:
        return "□"
    return "{" + ", ".join(str(l) for l in clause) + "}"


#  Knowledge Base


class KnowledgeBase:
    def __init__(self):
        self.clauses: list[frozenset] = []   # CNF clauses
        self.facts: list[str] = []           # human-readable log
        self.total_steps = 0

    
    def tell_no_pit(self, r, c):
        lit = Literal(f"P_{r}_{c}", negated=True)
        cl  = frozenset([lit])
        if cl not in self.clauses:
            self.clauses.append(cl)
            self.facts.append(f"TELL: ¬P_{r}_{c}  (visited, no pit)")

    def tell_no_wumpus(self, r, c):
        lit = Literal(f"W_{r}_{c}", negated=True)
        cl  = frozenset([lit])
        if cl not in self.clauses:
            self.clauses.append(cl)
            self.facts.append(f"TELL: ¬W_{r}_{c}  (visited, no wumpus)")

    def tell_breeze(self, r, c, neighbors):
        """
        B_{r}_{c} ⇔ ∨ P_adj
        In CNF:
          ¬B  ∨  P_n1  ∨  P_n2  …      (B → ∨P_adj)
          ¬P_ni ∨ B                      (each P_adj → B)
        Since we *know* B is true here, we just add its
        positive fact and the implication:
          P_n1 ∨ P_n2 ∨ …
        """
        # Unit clause: B_{r}_{c} is true
        b_lit = Literal(f"B_{r}_{c}")
        self.clauses.append(frozenset([b_lit]))
        self.facts.append(f"TELL: B_{r}_{c} is TRUE (breeze perceived)")

        # Biconditional right-side: at least one neighbour has a pit
        pit_lits = [Literal(f"P_{nr}_{nc}") for (nr, nc) in neighbors]
        if pit_lits:
            cl = frozenset(pit_lits)
            if cl not in self.clauses:
                self.clauses.append(cl)
                self.facts.append(
                    f"TELL: P_{neighbors[0][0]}_{neighbors[0][1]}" +
                    ("∨…" if len(neighbors) > 1 else "") + "  (B ⇒ pit nearby)"
                )

    def tell_no_breeze(self, r, c, neighbors):
        """No breeze ⇒ no pit in any neighbour."""
        b_lit = Literal(f"B_{r}_{c}", negated=True)
        self.clauses.append(frozenset([b_lit]))
        self.facts.append(f"TELL: ¬B_{r}_{c}  (no breeze)")
        for (nr, nc) in neighbors:
            lit = Literal(f"P_{nr}_{nc}", negated=True)
            cl  = frozenset([lit])
            if cl not in self.clauses:
                self.clauses.append(cl)
                self.facts.append(f"TELL: ¬P_{nr}_{nc}  (no breeze → no pit)")

    def tell_stench(self, r, c, neighbors):
        s_lit = Literal(f"S_{r}_{c}")
        self.clauses.append(frozenset([s_lit]))
        self.facts.append(f"TELL: S_{r}_{c} is TRUE (stench perceived)")

        w_lits = [Literal(f"W_{nr}_{nc}") for (nr, nc) in neighbors]
        if w_lits:
            cl = frozenset(w_lits)
            if cl not in self.clauses:
                self.clauses.append(cl)
                self.facts.append(
                    f"TELL: W_adj  (S ⇒ wumpus nearby)"
                )

    def tell_no_stench(self, r, c, neighbors):
        s_lit = Literal(f"S_{r}_{c}", negated=True)
        self.clauses.append(frozenset([s_lit]))
        self.facts.append(f"TELL: ¬S_{r}_{c}  (no stench)")
        for (nr, nc) in neighbors:
            lit = Literal(f"W_{nr}_{nc}", negated=True)
            cl  = frozenset([lit])
            if cl not in self.clauses:
                self.clauses.append(cl)
                self.facts.append(f"TELL: ¬W_{nr}_{nc}  (no stench → no wumpus)")

    def ask_safe(self, r, c):
        """
        Ask: is cell (r,c) safe?
        = prove ¬P_{r}_{c}  AND  ¬W_{r}_{c}
        """
        no_pit_lit    = Literal(f"P_{r}_{c}", negated=True)
        no_wumpus_lit = Literal(f"W_{r}_{c}", negated=True)

        safe_pit,    s1, t1 = resolution_refutation(list(self.clauses), no_pit_lit)
        safe_wumpus, s2, t2 = resolution_refutation(list(self.clauses), no_wumpus_lit)

        steps = s1 + s2
        self.total_steps += steps
        trace = t1 + t2
        return safe_pit and safe_wumpus, steps, trace




class WumpusWorld:
    def __init__(self, rows: int, cols: int, num_pits: int):
        self.rows = rows
        self.cols = cols

        # Agent always starts at (0,0)
        all_cells = [(r, c) for r in range(rows) for c in range(cols)
                     if (r, c) != (0, 0)]

        random.shuffle(all_cells)
        num_pits = min(num_pits, len(all_cells) - 1)
        self.pits    = set(map(tuple, all_cells[:num_pits]))
        self.wumpus  = tuple(all_cells[num_pits]) if len(all_cells) > num_pits else None

        # Agent state
        self.agent    = (0, 0)
        self.visited  = {(0, 0)}
        self.safe_confirmed: set = {(0, 0)}
        self.dead     = False
        self.won      = False
        self.gold_pos = random.choice([c for c in all_cells[num_pits+1:]] or [(0,0)])

        # KB
        self.kb = KnowledgeBase()

        # Step log
        self.log: list[str] = []
        self.step_count = 0

        # Process starting cell
        self._process_cell(0, 0)

    def _neighbors(self, r, c):
        out = []
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r+dr, c+dc
            if 0 <= nr < self.rows and 0 <= nc < self.cols:
                out.append((nr, nc))
        return out

    def _process_cell(self, r, c):
        """Update KB with percepts at (r,c)."""
        self.kb.tell_no_pit(r, c)
        self.kb.tell_no_wumpus(r, c)
        self.safe_confirmed.add((r, c))

        nbrs = self._neighbors(r, c)
        breeze = any(n in self.pits for n in nbrs)
        stench = self.wumpus in nbrs

        if breeze:
            self.kb.tell_breeze(r, c, nbrs)
        else:
            self.kb.tell_no_breeze(r, c, nbrs)

        if stench:
            self.kb.tell_stench(r, c, nbrs)
        else:
            self.kb.tell_no_stench(r, c, nbrs)

        percepts = []
        if breeze:  percepts.append("Breeze")
        if stench:  percepts.append("Stench")
        if (r,c) == self.gold_pos: percepts.append("Glitter")
        self.log.append(
            f"Agent at ({r},{c}) | Percepts: {percepts or ['None']}"
        )

    def _ask_safe(self, r, c):
        safe, steps, trace = self.kb.ask_safe(r, c)
        self.log.append(
            f"ASK safe({r},{c})? → {'YES' if safe else 'NO'} [{steps} steps]"
        )
        return safe

    
    def agent_step(self):
        if self.dead or self.won:
            return self.get_state()

        r, c = self.agent
        self.step_count += 1

        # Find unvisited neighbours
        nbrs = self._neighbors(r, c)
        unvisited = [n for n in nbrs if n not in self.visited]

        # Ask KB which are safe
        safe_moves   = [n for n in unvisited if self._ask_safe(*n)]
        unsafe_moves = [n for n in unvisited if n not in safe_moves]

        moved = False
        if safe_moves:
            target = safe_moves[0]
            for m in safe_moves:
                if m == self.gold_pos:
                    target = m
                    break
            self.agent = target
            self.visited.add(target)
            self.safe_confirmed.add(target)
            self._process_cell(*target)
            moved = True
        elif unsafe_moves:
            visited_nbrs = [n for n in nbrs if n in self.visited]
            if visited_nbrs:
                self.agent = visited_nbrs[0]
                self.log.append(f"No safe unvisited cell; backtracking to {visited_nbrs[0]}")
                moved = True
            else:
                self.log.append("Agent is stuck with no safe move.")
        else:
            # All neighbours visited; try to explore globally
            all_unvisited = [
                (row, col)
                for row in range(self.rows)
                for col in range(self.cols)
                if (row, col) not in self.visited
            ]
            safe_global = [n for n in all_unvisited if self._ask_safe(*n)]
            if safe_global:
                self.agent = safe_global[0]
                self.visited.add(self.agent)
                self.safe_confirmed.add(self.agent)
                self._process_cell(*self.agent)
                moved = True
            else:
                self.log.append("Exploration complete or no safe moves remain.")

        # Check outcomes
        if self.agent in self.pits:
            self.dead = True
            self.log.append("💀 Agent fell into a pit!")
        elif self.agent == self.wumpus:
            self.dead = True
            self.log.append("💀 Agent eaten by Wumpus!")
        elif self.agent == self.gold_pos:
            self.won = True
            self.log.append("🏆 Agent found the gold! Victory!")

        return self.get_state()

    # ── serialise for API 
    def get_state(self):
        r, c = self.agent
        nbrs = self._neighbors(r, c)
        breeze = any(n in self.pits for n in nbrs)
        stench = self.wumpus in nbrs

        percepts = []
        if breeze:  percepts.append("Breeze")
        if stench:  percepts.append("Stench")
        if self.agent == self.gold_pos: percepts.append("Glitter")

        # Build grid info
        grid = []
        for row in range(self.rows):
            grid_row = []
            for col in range(self.cols):
                cell = {
                    "r": row, "c": col,
                    "visited":   (row, col) in self.visited,
                    "safe":      (row, col) in self.safe_confirmed,
                    "agent":     (row, col) == self.agent,
                    "pit":       (row, col) in self.pits,
                    "wumpus":    (row, col) == self.wumpus,
                    "gold":      (row, col) == self.gold_pos,
                }
                reveal = self.dead or self.won
                cell["show_pit"]    = cell["pit"]    and (cell["visited"] or reveal)
                cell["show_wumpus"] = cell["wumpus"] and (cell["visited"] or reveal)
                grid_row.append(cell)
            grid.append(grid_row)

        return {
            "rows": self.rows,
            "cols": self.cols,
            "agent": list(self.agent),
            "visited": [list(v) for v in self.visited],
            "safe_confirmed": [list(s) for s in self.safe_confirmed],
            "percepts": percepts,
            "dead": self.dead,
            "won": self.won,
            "inference_steps": self.kb.total_steps,
            "step_count": self.step_count,
            "kb_facts": self.kb.facts[-20:],   # last 20 facts
            "log": self.log[-15:],
            "grid": grid,
        }
