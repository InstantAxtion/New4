#!/usr/bin/env python3
"""Move groups of top-level declarations out of a big ES module into new modules.

  python3 scripts/split-module.py web/js/ui.js spec.json

spec.json: {"ui/common.js": ["$", "esc", ...], "ui/research.js": ["showResearch", ...]}
Paths in the spec are relative to the source file's folder.

For every moved group the tool:
  * cuts each declaration (with the comment lines just above it) out of the source,
  * works out which names the moved code uses, and imports them: from the original module's own
    imports, from the source module (which then exports them), or from another new module,
  * makes the source import back whatever it still uses from the new modules.
It refuses to move code that assigns to a `let` left behind in another module (ES module imports are
read-only), so shared state always stays with the code that changes it.
"""
import json, os, re, sys

src_path, spec_path = sys.argv[1], sys.argv[2]
spec = json.load(open(spec_path))
src_dir = os.path.dirname(src_path)
text = open(src_path).read()
lines = text.split('\n')

DECL = re.compile(r'^(export\s+)?(?:(async\s+)?function\s+([A-Za-z_$][\w$]*)|(const|let)\s+(.+))')
IDENT = re.compile(r'(?<![\w$])(?<![^.]\.)([A-Za-z_$][\w$]*)')  # skip obj.prop, keep ...spread

def decl_names(line):
    m = DECL.match(line)
    if not m: return None
    if m.group(3): return [m.group(3)]
    rest = m.group(5)
    # names declared at depth 0 in "a = 1, b = 2" (ignore names inside brackets/strings)
    names, depth, i, tok = [], 0, 0, ''
    expect = True
    while i < len(rest):
        c = rest[i]
        if c in '([{': depth += 1
        elif c in ')]}': depth -= 1
        elif c in '\'"`':
            q = c; i += 1
            while i < len(rest) and rest[i] != q:
                if rest[i] == '\\': i += 1
                i += 1
        elif depth == 0 and c == ',': expect = True
        elif depth == 0 and expect and re.match(r'[A-Za-z_$]', c):
            m2 = re.match(r'[A-Za-z_$][\w$]*', rest[i:]); names.append(m2.group(0)); i += len(m2.group(0)); expect = False; continue
        elif depth == 0 and c == ';': break
        i += 1
    return names

# 1. find top-level blocks: a declaration starts at column 0 and runs until the next column-0 line
#    that is not a closing bracket / continuation (comments directly above belong to the next block)
starts = []
for k, l in enumerate(lines):
    if l and not l[0].isspace() and not l.startswith(('}', ')', ']', '//', '/*', '*', 'import')):
        starts.append(k)
blocks = []  # (start, end_exclusive, names, is_decl)
for n, k in enumerate(starts):
    end = starts[n + 1] if n + 1 < len(starts) else len(lines)
    # pull trailing comment lines into the next block
    e = end
    while e - 1 > k and lines[e - 1].startswith('//'): e -= 1
    c = k
    while c > 0 and lines[c - 1].startswith('//') and not any(b[0] <= c - 1 < b[1] for b in blocks if b[1] > c - 1 and b[0] < c - 1): c -= 1
    names = decl_names(lines[k]) or []
    blocks.append([k, e, names])
# attach leading comments: extend each block start upward over comment lines not owned by a previous block
for b in blocks:
    s = b[0]
    while s > 0 and lines[s - 1].startswith('//'): s -= 1
    b.append(s)

# imports of the source module
imports = {}  # name -> module path (as written)
imp_re = re.compile(r'^import\s+\{([^}]*)\}\s+from\s+\'([^\']+)\';', re.M)
for m in imp_re.finditer(text):
    for part in m.group(1).split(','):
        part = part.strip()
        if not part: continue
        if ' as ' in part: orig, alias = [p.strip() for p in part.split(' as ')]
        else: orig = alias = part
        imports[alias] = (m.group(2), orig)
ns_re = re.compile(r'^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+\'([^\']+)\';', re.M)
namespaces = {m.group(1): m.group(2) for m in ns_re.finditer(text)}

name_block = {}
for b in blocks:
    for nm in b[2]: name_block[nm] = b
lets = set()
for b in blocks:
    if re.match(r'^(export\s+)?let\s', lines[b[0]]): lets.update(b[2])

target = {}  # name -> new module (relative to src_dir)
for mod, names in spec.items():
    for nm in names:
        if nm not in name_block: sys.exit(f'unknown top-level name: {nm}')
        target[nm] = mod
# a block moves if all its names go to the same module
moving = {}
for b in blocks:
    mods = {target.get(nm) for nm in b[2]}
    if not b[2] or mods == {None}: continue
    if len(mods) != 1 or None in mods: sys.exit(f'names declared together must move together: {b[2]}')
    moving[id(b)] = (b, mods.pop())

def body(b): return '\n'.join(lines[b[3]:b[1]])
def strip_strings(code):
    # drop comments and plain strings; keep ${...} expressions inside template literals
    code = re.sub(r'//[^\n]*', ' ', code)
    out, i, n = [], 0, len(code)
    while i < n:
        c = code[i]
        if c == '/' and i + 1 < n and code[i + 1] not in '/*':
            prev = ''.join(out).rstrip()[-1:]
            if prev == '' or prev in '(,=:[!&|?{};+-*%<>~^':  # a regex literal, not division
                j, cls = i + 1, False
                while j < n and (code[j] != '/' or cls):
                    if code[j] == '\\': j += 1
                    elif code[j] == '[': cls = True
                    elif code[j] == ']': cls = False
                    j += 1
                i = j + 1; out.append(' /r/'); continue
        if c in '\'"':
            j = i + 1
            while j < n and code[j] != c:
                if code[j] == '\\': j += 1
                j += 1
            i = j + 1; out.append(' ""'); continue
        if c == '`':
            j, depth = i + 1, 0
            while j < n:
                if code[j] == '\\': j += 2; continue
                if code[j] == '$' and j + 1 < n and code[j + 1] == '{':
                    k, d = j + 2, 1
                    while k < n and d:
                        if code[k] == '{': d += 1
                        elif code[k] == '}': d -= 1
                        k += 1
                    out.append(' ' + strip_strings(code[j + 2:k - 1]) + ' '); j = k; continue
                if code[j] == '`': break
                j += 1
            i = j + 1; continue
        out.append(c); i += 1
    return ''.join(out)
def used(code):
    code = strip_strings(code)
    found = set(IDENT.findall(code))
    # drop object keys like {name: ...} - harmless if kept, but keeps imports tidy
    return found

src_name = os.path.basename(src_path)
def rel(from_mod, to_mod):
    a = os.path.dirname(os.path.join(src_dir, from_mod)); b = os.path.join(src_dir, to_mod)
    r = os.path.relpath(b, a)
    return r if r.startswith('.') else './' + r
def rewrite_spec(from_mod, spec_path_written):
    # an import path written in the source, re-expressed relative to a new module
    return rel(from_mod, os.path.relpath(os.path.normpath(os.path.join(src_dir, spec_path_written)), src_dir))

new_files = {}
needs_export_from_src = set()
src_imports_from_new = {}  # module -> set(names)
for mod in spec:
    blks = [b for (b, m) in moving.values() if m == mod]
    blks.sort(key=lambda b: b[0])
    code = '\n\n'.join(body(b) for b in blks)
    declared = {nm for b in blks for nm in b[2]}
    uses = used(code) - declared
    # refuse writes to lets that stay elsewhere
    for nm in uses & lets:
        if target.get(nm) == mod: continue
        if re.search(r'(?<![\w$.])' + re.escape(nm) + r'\s*(=(?!=)|\+\+|--|\+=|-=|\|\|=|\?\?=)', strip_strings(code)):
            sys.exit(f'{mod}: assigns to `{nm}`, which stays in another module. Move them together or add a setter.')
    imps = {}  # path -> set of "orig as alias" strings
    nss = {}
    for nm in sorted(uses):
        if nm in declared: continue
        if nm in target and target[nm] != mod:
            imps.setdefault(rel(mod, target[nm]), set()).add(nm)
        elif nm in name_block and nm not in target:
            imps.setdefault(rel(mod, src_name), set()).add(nm); needs_export_from_src.add(nm)
        elif nm in imports:
            path, orig = imports[nm]
            imps.setdefault(rewrite_spec(mod, path), set()).add(nm if orig == nm else f'{orig} as {nm}')
        elif nm in namespaces:
            nss[nm] = rewrite_spec(mod, namespaces[nm])
    head = [f"import {{ {', '.join(sorted(v))} }} from '{p}';" for p, v in sorted(imps.items())]
    head += [f"import * as {k} from '{p}';" for k, p in sorted(nss.items())]
    # export everything declared here (names used by others; unused exports are harmless)
    out_code = []
    for b in blks:
        seg = body(b).split('\n')
        k = b[0] - b[3]
        if not seg[k].startswith('export '): seg[k] = 'export ' + seg[k]
        out_code.append('\n'.join(seg))
    new_files[mod] = (head, out_code, declared)

# what the source still uses from new modules
remaining = []
moved_ranges = [(b[3], b[1]) for (b, _) in moving.values()]
for k, l in enumerate(lines):
    if not any(s <= k < e for s, e in moved_ranges): remaining.append(l)
rem_code = '\n'.join(remaining)
rem_used = used(re.sub(r'^import[^\n]*\n', '', rem_code, flags=re.M))
for nm in rem_used:
    if nm in target: src_imports_from_new.setdefault(target[nm], set()).add(nm)

# write new modules
for mod, (head, out_code, declared) in new_files.items():
    path = os.path.join(src_dir, mod)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    banner = f"// Moved out of {src_name} to keep modules small. See ARCHITECTURE.md.\n"
    open(path, 'w').write(banner + '\n'.join(head) + '\n\n' + '\n\n'.join(out_code).rstrip() + '\n')

# rewrite the source: drop moved blocks, export what new modules need, import what it uses from them
out = []
for k, l in enumerate(lines):
    if any(s <= k < e for s, e in moved_ranges): continue
    out.append(l)
res = '\n'.join(out)
for nm in needs_export_from_src:
    b = name_block[nm]
    first = lines[b[0]]
    if first.startswith('export '): continue
    res = res.replace('\n' + first, '\nexport ' + first, 1) if ('\n' + first) in res else res.replace(first, 'export ' + first, 1)
imp_lines = [f"import {{ {', '.join(sorted(v))} }} from '{rel(src_name, m)}';" for m, v in sorted(src_imports_from_new.items())]
# put them after the last import line
last_imp = max(m.end() for m in re.finditer(r'^import[^\n]*;\s*$', res, re.M))
res = res[:last_imp] + '\n' + '\n'.join(imp_lines) + res[last_imp:]
res = re.sub(r'\n{3,}', '\n\n', res)
open(src_path, 'w').write(res)
print('moved', sum(len(v) for v in spec.values()), 'names into', len(spec), 'modules;',
      'source now', res.count('\n'), 'lines')
