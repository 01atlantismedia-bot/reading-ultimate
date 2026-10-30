#!/usr/bin/env python3
"""Turns a 'FULL_READING.html' style test (passages and answer key stored inside the page's JavaScript)
into 3 Aphrodite passage JSON files, with anchor words and evidence sentences worked out like import_test.py.
Usage: python3 tools/import_full_reading.py <test-number> <path/to/FULL_READING.html>
The page's own password (if it has one) is never read or copied."""
import sys, re, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_test as I

ROOT = Path(__file__).resolve().parent.parent
TF = ["TRUE", "FALSE", "NOT GIVEN"]

def grab(js, name, nxt):
    m = re.search(r"const " + name + r"=(\{.*?\});\nconst " + nxt, js, re.S)
    return json.loads(m.group(1))

def summary(js, fn, first_q):
    """returns (title, template with {{n}} markers) of the summary box that contains question first_q"""
    body = js[js.index("function " + fn):]
    for m in re.finditer(r'<div class="summary-box"><div style="[^"]*">(.*?)</div>(.*?)</div>', body, re.S):
        if "textInput(%d)" % first_q in m.group(2):
            t = re.sub(r"\$\{textInput\((\d+)\)\}", r"{{\1}}", m.group(2))
            return m.group(1).strip(), t.strip()
    raise SystemExit("summary for question %d not found" % first_q)

def blank(t): return re.sub(r"_{3,}", "_____", t)

def build(num, path):
    s = Path(path).read_text(encoding="utf8"); js = s[s.index("<script"):]
    P = grab(js, "passages", "answerAliases"); AL = grab(js, "answerAliases", "canonicalAnswers")
    CA = grab(js, "canonicalAnswers", "q="); Q = grab(js, "q", "state=")
    def ans(n): return CA[str(n)]
    def acc(q, n):
        a = [x for x in AL.get(str(n), []) if x != ans(n)]
        if a: q["accept"] = [ans(n)] + a
        return q
    def tf(n, t): return {"id": "q%d" % n, "n": n, "prompt": t, "options": TF, "answer": ans(n)}
    def sel(n, t, opts): return {"id": "q%d" % n, "n": n, "prompt": t, "options": opts, "answer": ans(n)}
    def kt(items): return [{"k": x.split(" ", 1)[0], "t": x.split(" ", 1)[1]} for x in items]
    def tmpl_group(gid, title, intro, fn, a, b):
        ttl, tm = summary(js, fn, a); sents = I.split_sentences(re.sub(r"\{\{(\d+)\}\}", r"[\1]", tm))
        qs = []
        for n in range(a, b + 1):
            ctx = next((x for x in sents if "[%d]" % n in x), tm)
            ctx = re.sub(r"\[%d\]" % n, "_____", ctx); ctx = re.sub(r"\[\d+\]", "…", ctx)
            qs.append(acc({"id": "q%d" % n, "n": n, "prompt": ctx, "answer": ans(n)}, n))
        return {"id": gid, "title": "Questions %d–%d" % (a, b), "intro": intro, "type": "completion", "questions": qs,
                "template": '<p class="ct"><strong>' + ttl + "</strong></p><p>" + tm + "</p>"}
    parts = {}
    # ---- passage 1
    parts[1] = [
        {"id": "g1", "title": "Questions 1–8", "type": "completion", "intro": "<p>Complete the sentences below.</p><p>Choose <strong>ONE WORD ONLY</strong> from the passage for each answer.</p><p class=\"ct\"><strong>The Phoenicians’ trading activities</strong></p>",
         "questions": [acc({"id": "q%d" % n, "n": n, "prompt": blank(t), "answer": ans(n)}, n) for n, t in Q["p1fill"]]},
        {"id": "g2", "title": "Questions 9–13", "type": "tfng", "intro": "<p>Do the following statements agree with the information given in Reading Passage 1?</p><p>Choose <strong>TRUE</strong>, <strong>FALSE</strong>, or <strong>NOT GIVEN</strong>.</p>",
         "questions": [tf(n, t) for n, t in Q["p1tf"]]}]
    # ---- passage 2
    roman = [x.split(" ", 1)[0] for x in Q["p2headings"]]
    parts[2] = [
        {"id": "g1", "title": "Questions 14–19", "type": "heading", "intro": "<p>Reading Passage 2 has six paragraphs, <strong>A–F</strong>.</p><p>Choose the correct heading for each paragraph from the list of headings below. Write the correct number, <strong>i–viii</strong>.</p>",
         "list": kt(Q["p2headings"]), "questions": [sel(n, t, roman) for n, t in Q["p2match"]]},
        {"id": "g2", "title": "Questions 20–23", "type": "tfng", "intro": "<p>Do the following statements agree with the information given in Reading Passage 2?</p><p>Choose <strong>TRUE</strong>, <strong>FALSE</strong>, or <strong>NOT GIVEN</strong>.</p>",
         "questions": [tf(n, t) for n, t in Q["p2tf"]]},
        tmpl_group("g3", "", "<p>Complete the summary below.</p><p>Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.</p>", "renderQ2", 24, 26)]
    # ---- passage 3
    parts[3] = [
        {"id": "g1", "title": "Questions 27–30", "type": "match", "intro": "<p>Complete each sentence with the correct ending, <strong>A–F</strong>, below.</p><p>Write the correct letter, <strong>A–F</strong>.</p>",
         "list": kt(Q["p3endings"]), "questions": [sel(n, t, list("ABCDEF")) for n, t in Q["p3match"]]},
        tmpl_group("g2", "", "<p>Complete the summary below.</p><p>Choose <strong>ONE WORD ONLY</strong> from the passage for each answer.</p>", "renderQ3", 31, 35),
        {"id": "g3", "title": "Questions 36–40", "type": "match", "intro": "<p>Reading Passage 3 has eight paragraphs, <strong>A–H</strong>. Which paragraph contains the following information?</p><p>Write the correct letter, <strong>A–H</strong>. <strong>NB</strong> You may use any letter more than once.</p>",
         "questions": [sel(n, t, list("ABCDEFGH")) for n, t in Q["p3paragraphs"]]}]
    md = ["\n## Test %s\n" % num]
    outs = [ROOT / "worker" / "passages", ROOT / "web" / "data"]; outs[1].mkdir(exist_ok=True)
    for part in (1, 2, 3):
        d = P[str(part)]; paras = []
        texts = [x for x in d["paras"] if x.get("text") and not x.get("heading")]
        for i, x in enumerate(texts, 1):
            paras.append({"id": "p%d" % i, "label": x.get("letter") or "", "sentences": [{"id": "p%ds%d" % (i, j), "text": t} for j, t in enumerate(I.split_sentences(x["text"]), 1)]})
        groups = parts[part]
        sents = [(sn["id"], sn["text"], pa["id"]) for pa in paras for sn in pa["sentences"]]
        stems = {}
        for _, t, _ in sents:
            for w in set(I.stem(x) for x in I.words(t)): stems[w] = stems.get(w, 0) + 1
        by_label = {pa["label"]: pa["id"] for pa in paras if pa["label"]}
        md.append("\n### Passage %d: %s\n\n| Q | Type | Anchor words (in the question) | Where to look | Confidence |\n|---|---|---|---|---|" % (part, d["sub"]))
        for g in groups:
            for q in g["questions"]:
                a, sid, conf = I.anchors_for(q, g, paras, g["intro"], sents, stems, by_label)
                q["anchors"] = a; q["evidence"] = sid; q["conf"] = conf
                if sid:
                    pa = next(p for p in paras if sid.startswith(p["id"] + "s"))
                    q["where"] = (("paragraph " + pa["label"]) if pa["label"] else "paragraph " + pa["id"][1:]) + ", sentence " + sid.split("s")[1]
                    st = next(t for i, t, _ in sents if i == sid); wset = {I.stem(x) for x in a for x in I.words(x)}
                    q["matches"] = [w for w in I.words(st) if I.stem(w) in wset][:6]
                md.append("| %s | %s | %s | %s | %s |" % (q["n"], g["type"], ", ".join(a) or "—", q.get("where", "—"), conf))
        pid = "test-%s-p%d" % (num, part)
        data = {"id": pid, "format": "test", "test": int(num), "part": part, "title": d["sub"], "subtitle": d.get("intro") or "", "level": "Academic Reading", "minutes": 20, "paragraphs": paras, "groups": groups}
        for o in outs: (o / (pid + ".json")).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf8")
        print(pid, d["sub"], sum(1 for g in groups for _ in g["questions"]), "questions")
    with open(ROOT / "ANCHORS.md", "a", encoding="utf8") as f: f.write("\n".join(md) + "\n")

if __name__ == "__main__": build(sys.argv[1], sys.argv[2])
