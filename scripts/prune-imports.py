#!/usr/bin/env python3
"""Remove imports that ESLint reports as unused (handles multi-line import lists).
  npx eslint web/js -f json > lint.json && python3 scripts/prune-imports.py lint.json
"""
import json, re, sys
for f in json.load(open(sys.argv[1])):
    unused = {}
    for m in f['messages']:
        if m.get('ruleId') == 'no-unused-vars':
            n = re.search(r"'([^']+)'", m['message'])
            if n: unused.setdefault(m['line'], set()).add(n.group(1))
    if not unused: continue
    src = open(f['filePath']).read()
    lines = src.split('\n')
    # map each import statement to its line span
    starts = [k for k, l in enumerate(lines) if l.startswith('import ')]
    changed = False
    for s in starts:
        e = s
        while not re.search(r"from\s+'[^']+';\s*$", lines[e]): e += 1
        names = set().union(*[unused.get(k + 1, set()) for k in range(s, e + 1)])
        if not names: continue
        stmt = '\n'.join(lines[s:e + 1])
        m = re.match(r"import\s+\*\s+as\s+(\w+)\s+from", stmt)
        if m:
            if m.group(1) in names: lines[s:e + 1] = [''] + [None] * (e - s); changed = True
            continue
        body = re.search(r'\{([^}]*)\}', stmt)
        if not body: continue
        parts = [p.strip() for p in body.group(1).split(',') if p.strip()]
        keep = [p for p in parts if (p.split(' as ')[-1].strip()) not in names]
        if len(keep) == len(parts): continue
        frm = re.search(r"from\s+'[^']+';", stmt).group(0)
        new = f"import {{ {', '.join(keep)} }} {frm}" if keep else None
        lines[s:e + 1] = [new] + [None] * (e - s)
        changed = True
    if changed:
        open(f['filePath'], 'w').write('\n'.join(l for l in lines if l is not None))
        print('pruned', f['filePath'])
