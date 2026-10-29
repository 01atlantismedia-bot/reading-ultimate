/* Aphrodite reader: two panes (passage | questions), bottom question navigator, Exam and Practice modes.
   Practice = anchors, hints, instant checking, explanations. Exam = timed, no help, results after submit. */
(function () {
  'use strict';
  var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, R = null, popTimer;
  var L = function (en, ru) { return A.S.lang === 'ru' ? ru : en; };
  var BAND = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4]];
  var band = function (n) { for (var i = 0; i < BAND.length; i++) if (n >= BAND[i][0]) return BAND[i][1]; return '< 4'; };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim(); };
  var isMulti = function (q) { return Array.isArray(q.answer); };

  /* ---------- grading ---------- */
  function ok(q, val) {
    if (!val) return false;
    if (isMulti(q)) return q.answer.slice().sort().join(',') === val.split(',').filter(Boolean).sort().join(',');
    return [q.answer].concat(q.accept || []).map(norm).indexOf(norm(val)) >= 0;
  }
  function marks(q, val) { if (!isMulti(q)) return ok(q, val) ? 1 : 0; return (val ? val.split(',') : []).filter(function (x) { return q.answer.indexOf(x) >= 0; }).length; }
  function listText(g, k) { var x = (g.list || []).filter(function (i) { return i.k === k; })[0]; return x ? x.t : ''; }
  function ansLabel(g, q) {
    if (isMulti(q)) return q.answer.join(', ');
    if (g.type === 'mcq') { var o = q.options.filter(function (x) { return x.charAt(0) === q.answer; })[0]; return o || q.answer; }
    if (g.type === 'bank' || g.type === 'match') { var t = listText(g, q.answer); return t ? q.answer + ' — ' + t : q.answer; }
    return q.answer;
  }
  function sentText(p, sid) { var t = ''; p.paragraphs.forEach(function (pa) { pa.sentences.forEach(function (s) { if (s.id === sid) t = s.text; }); }); return t; }

  /* ---------- building the screen ---------- */
  function qa(text, anchors) { // underline anchor words inside a question (visible when Anchors is on)
    var h = esc(text);
    (anchors || []).slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (w) {
      var re = new RegExp('(^|[^\\w])(' + esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\w])', 'gi');
      h = h.replace(re, '$1<mark class="qa">$2</mark>');
    });
    return h;
  }
  function optLabel(g, k) { var t = listText(g, k); return t ? k + (g.type === 'heading' ? ' — ' : '  ') + t : k; }
  function qHTML(g, q, pi) {
    var an = R.mode === 'practice' ? q.anchors : null, num = '<span class="qn' + (q.n2 ? ' wide' : '') + '" id="qn-' + pi + '-' + q.n + '">' + q.n + (q.n2 ? '–' + q.n2 : '') + '</span>', body = '', prompt = '<p class="qtext">' + qa(q.prompt, an) + '</p>';
    var three = g.type === 'tfng' || g.type === 'ynng';
    if (g.type === 'heading' || g.type === 'match') {
      body = '<select data-q="' + q.id + '" aria-label="Question ' + q.n + '"><option value=""></option>' + q.options.map(function (k) { return '<option value="' + esc(k) + '">' + esc(optLabel(g, k)) + '</option>'; }).join('') + '</select>';
    } else if (q.options) {
      body = '<div class="opts ' + (three ? 'three' : '') + '" data-q="' + q.id + '"' + (isMulti(q) ? ' data-multi="' + (q.marks || 2) + '"' : '') + '>' + q.options.map(function (o) {
        var v = (g.type === 'mcq' || g.type === 'multi') ? o.charAt(0) : o; return '<button type="button" class="opt" data-v="' + esc(v) + '" aria-pressed="false">' + esc(o) + '</button>'; }).join('') + '</div>';
    } else { // sentence completion (no template): the blank sits inside the sentence
      var inp = '<input class="blank" data-q="' + q.id + '" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Answer ' + q.n + '">';
      prompt = /_{3,}/.test(q.prompt) ? '<p class="qtext">' + qa(q.prompt, an).replace(/_{3,}/, inp) + '</p>' : prompt;
      body = /_{3,}/.test(q.prompt) ? '' : inp;
    }
    return '<div class="q" data-qid="' + q.id + '">' + num + prompt + body + '</div>';
  }
  function tmplHTML(g, pi) {
    var t = g.template.replace(/\{\{(\d+)\}\}/g, function (m, n) {
      var q = g.questions.filter(function (x) { return x.n === +n; })[0]; if (!q) return '';
      var chip = '<span class="bn" id="qn-' + pi + '-' + q.n + '">' + q.n + '</span>';
      if (g.type === 'bank') return chip + '<select data-q="' + q.id + '" aria-label="Question ' + q.n + '"><option value=""></option>' + q.options.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k + '. ' + listText(g, k)) + '</option>'; }).join('') + '</select>';
      return chip + '<input class="blank" data-q="' + q.id + '" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Answer ' + q.n + '">';
    });
    return '<div class="tmpl">' + t + '</div>';
  }
  function groupHTML(g, pi) {
    var listTitle = g.type === 'heading' ? L('List of headings', 'Список заголовков') : g.type === 'bank' ? L('Word bank', 'Слова для выбора') : L('List', 'Список');
    return '<section class="qgroup" data-g="' + g.id + '" data-pi="' + pi + '"><h3>' + esc(g.title) + '</h3><div class="intro">' + (g.intro || '<p>' + A.tx(g.instructions) + '</p>') + '</div>' +
      (g.list ? '<div class="listbox"><b>' + listTitle + '</b><ul>' + g.list.map(function (x) { return '<li><b>' + esc(x.k) + '</b>' + esc(x.t) + '</li>'; }).join('') + '</ul></div>' : '') +
      (g.template ? tmplHTML(g, pi) : g.questions.map(function (q) { return qHTML(g, q, pi); }).join('')) +
      (R.mode === 'practice' ? '<div class="helpbar"><button class="btn small ghost" data-act="hint">' + L('Hints', 'Подсказки') + '</button><button class="btn small" data-act="check">' + L('Check answers', 'Проверить') + '</button></div><div class="feed"></div>' : '') + '</section>';
  }
  function textHTML(p, pi) {
    var prac = R.mode === 'practice';
    return '<h1>' + esc(p.title) + '</h1>' + (p.subtitle ? '<p class="sub">' + esc(p.subtitle) + '</p>' : '') +
      (prac ? '<div class="rdlegend"><span><i style="background:var(--hl-name)"></i>' + L('names', 'имена') + '</span><span><i style="background:var(--hl-num)"></i>' + L('numbers & dates', 'числа и даты') + '</span><span><i style="background:var(--hl-link)"></i>' + L('linking & limiting words', 'связки и ограничители') + '</span></div>' : '') +
      p.paragraphs.map(function (pa) {
        return '<p class="para">' + (pa.label ? '<span class="plabel">' + esc(pa.label) + '</span>' : '') + pa.sentences.map(function (s) {
          return '<span class="sent" id="s-' + pi + '-' + s.id + '">' + (prac ? A.markup(s.text, p.glossary || []) : esc(s.text)) + '</span>'; }).join(' ') + '</p>'; }).join('');
  }

  /* ---------- start ---------- */
  function start(app, T, scope, mode, ps) {
    stop();
    var minutes = ps.reduce(function (n, p) { return n + (p.minutes || 20); }, 0);
    R = { mode: mode, T: T, scope: scope, ps: ps, cur: 0, vals: {}, cause: {}, attemptId: A.uid(), t0: Date.now(), left: minutes * 60, done: false, qs: {}, order: [] };
    ps.forEach(function (p, pi) { p.groups.forEach(function (g) { g.questions.forEach(function (q) { R.qs[q.id] = { q: q, g: g, p: p, pi: pi }; R.order.push(q.id); }); }); });
    var prac = mode === 'practice', anchorsOn = A.S.anchors == null ? A.scaffoldLevel() === 0 : A.S.anchors;
    var title = (+T ? L('Test ', 'Тест ') + T : L('Sample', 'Пробный текст')) + ' · ' + (scope === 'all' ? L('All three passages', 'Все три текста') : L('Passage ', 'Текст ') + scope);
    app.innerHTML = '<div class="rd' + (prac && anchorsOn ? ' anchors-on' : '') + '" id="rd" data-mode="' + mode + '"><header class="rd-top"><button class="icon-btn" id="rdExit" aria-label="' + L('Leave', 'Выйти') + '">←</button>' +
      '<div class="rd-title"><b>' + esc(title) + '</b><span class="rd-badge">' + (prac ? L('Practice', 'Практика') : L('Exam', 'Экзамен')) + '</span></div><div class="rd-tools">' +
      (prac ? '<button class="tg" id="tAnch" aria-pressed="' + anchorsOn + '">' + L('Anchors', 'Якоря') + '</button>' : '') +
      '<button class="tg hide-sm" id="tMinus" aria-label="Smaller text">A−</button><button class="tg hide-sm" id="tPlus" aria-label="Larger text">A+</button>' +
      '<button class="tg rd-switch" id="tSwitch">' + L('Questions', 'Вопросы') + '</button><span class="rd-time" id="rdTime"></span><button class="btn small accent" id="rdSubmit">' + L('Submit', 'Сдать') + '</button></div></header>' +
      '<div class="rd-body"><section class="rd-text" id="rdText">' + ps.map(function (p, i) { return '<div class="rd-part" data-i="' + i + '"' + (i ? ' hidden' : '') + '>' + textHTML(p, i) + '</div>'; }).join('') + '</section>' +
      '<section class="rd-qs" id="rdQs">' + ps.map(function (p, i) { return '<div class="rd-part" data-i="' + i + '"' + (i ? ' hidden' : '') + '>' + p.groups.map(function (g) { return groupHTML(g, i); }).join('') + '</div>'; }).join('') + '</section></div>' +
      '<nav class="rd-nav" id="rdNav" aria-label="Questions"></nav><div class="rd-hlpop" id="hlPop" hidden><button class="btn small" data-a="hl">' + L('Highlight', 'Выделить') + '</button><button class="btn small accent" data-a="tr" hidden>' + L('Translate', 'Перевод') + '</button></div></div>';
    buildNav(); wire(); tick(); R.timer = setInterval(tick, 1000); go(0); document.addEventListener('mouseup', onSelect); document.addEventListener('touchend', onTouch);
  }

  function numbers(p) { var out = []; p.groups.forEach(function (g) { g.questions.forEach(function (q) { for (var n = q.n; n <= (q.n2 || q.n); n++) out.push({ n: n, q: q }); }); }); return out; }
  function buildNav() {
    $('#rdNav').innerHTML = R.ps.map(function (p, i) {
      return '<div class="pt" data-i="' + i + '"><button class="ptb" data-go="' + i + '">' + L('Passage ', 'Текст ') + (+R.ps[i].part || i + 1) + ' <span class="cnt"></span></button>' + numbers(p).map(function (x) { return '<button class="cn" data-n="' + x.n + '" data-pi="' + i + '">' + x.n + '</button>'; }).join('') + '</div>';
    }).join('');
    refreshNav();
  }
  function selCount(q) { var v = R.vals[q.id]; return !v ? 0 : isMulti(q) ? v.split(',').filter(Boolean).length : 1; }
  function refreshNav() {
    R.ps.forEach(function (p, i) {
      var done = 0, all = 0, box = $('.pt[data-i="' + i + '"]');
      numbers(p).forEach(function (x) { all++; var idx = x.n - x.q.n, d = selCount(x.q) > idx; if (d) done++; $('.cn[data-n="' + x.n + '"][data-pi="' + i + '"]', box).classList.toggle('done', d); });
      $('.cnt', box).textContent = done + '/' + all;
    });
  }
  function go(i) {
    R.cur = i; $$('.rd-part').forEach(function (d) { d.hidden = +d.dataset.i !== i; });
    $$('.pt').forEach(function (d) { d.classList.toggle('cur', +d.dataset.i === i); });
    $('#rdText').scrollTop = 0; $('#rdQs').scrollTop = 0;
  }
  function tick() {
    var el = $('#rdTime'); if (!el || R.done) return;
    var f = function (s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    if (R.mode === 'exam') { R.left = Math.max(0, R.left - 1); el.textContent = f(R.left); el.classList.toggle('late', R.left < 300); if (!R.left) { A.toast(L('Time is up. Your answers were submitted.', 'Время вышло. Ответы отправлены.')); submit(true); } }
    else el.textContent = f(Math.round((Date.now() - R.t0) / 1000));
  }

  /* ---------- interaction ---------- */
  function setVal(qid, v) { R.vals[qid] = v; refreshNav(); }
  function wire() {
    var rd = $('#rd'), qs = $('#rdQs');
    $('#rdExit').onclick = function () { if (R.done || !Object.keys(R.vals).length || confirm(L('Leave now? Your answers will be lost.', 'Выйти? Ответы будут потеряны.'))) location.hash = '#/'; };
    $('#rdSubmit').onclick = function () { submit(false); };
    $('#tSwitch').onclick = function () { rd.classList.toggle('showq'); this.textContent = rd.classList.contains('showq') ? L('Passage', 'Текст') : L('Questions', 'Вопросы'); };
    var fs = 18, size = function (d) { fs = Math.min(26, Math.max(14, fs + d)); rd.style.setProperty('--fs', fs + 'px'); };
    $('#tMinus').onclick = function () { size(-1); }; $('#tPlus').onclick = function () { size(1); };
    var ta = $('#tAnch'); if (ta) ta.onclick = function () { var on = rd.classList.toggle('anchors-on'); this.setAttribute('aria-pressed', String(on)); A.S.anchors = on; A.persist(); };
    $('#rdNav').onclick = function (e) {
      var g = e.target.closest('[data-go]'); if (g) { go(+g.dataset.go); return; }
      var c = e.target.closest('.cn'); if (!c) return; var pi = +c.dataset.pi; if (pi !== R.cur) go(pi);
      var q = numbers(R.ps[pi]).filter(function (x) { return x.n === +c.dataset.n; })[0].q, el = $('#qn-' + pi + '-' + q.n);
      if (el) { rd.classList.add('showq'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); var inp = el.parentNode.querySelector('input,select,.opt'); if (inp && inp.focus) setTimeout(function () { inp.focus({ preventScroll: true }); }, 350); }
    };
    qs.addEventListener('click', function (e) {
      var o = e.target.closest('.opt');
      if (o) { var box = o.parentNode, id = box.dataset.q, v = o.dataset.v, cur = R.vals[id] ? R.vals[id].split(',') : [];
        if (box.dataset.multi) { var i = cur.indexOf(v); if (i >= 0) cur.splice(i, 1); else { cur.push(v); if (cur.length > +box.dataset.multi) cur.shift(); } cur.sort(); }
        else cur = cur[0] === v ? [] : [v];
        $$('.opt', box).forEach(function (b) { b.setAttribute('aria-pressed', String(cur.indexOf(b.dataset.v) >= 0)); }); setVal(id, cur.join(',')); return; }
      var b = e.target.closest('[data-act]'); if (b) { var sec = b.closest('.qgroup'); (b.dataset.act === 'hint' ? hint : check)(sec); return; }
      var l = e.target.closest('[data-loc]'); if (l) locate(l.dataset.loc); var t = e.target.closest('[data-cause]'); if (t) { R.cause[t.dataset.q] = t.dataset.cause; $$('[data-q="' + t.dataset.q + '"]', t.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); }); }
    });
    qs.addEventListener('input', function (e) { var id = e.target.dataset.q; if (id) setVal(id, e.target.value.trim()); });
    qs.addEventListener('change', function (e) { var id = e.target.dataset.q; if (id && e.target.tagName === 'SELECT') setVal(id, e.target.value); });
    $('#rdText').addEventListener('click', function (e) {
      var m = e.target.closest('mark.hl'); if (m) { var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); return; }
      var v = e.target.closest('.vocab'); if (v && R.mode === 'practice') { A.setRun({ p: R.ps[R.cur] }); A.vocabSheet(v.dataset.w); }
    });
    $('#hlPop').onclick = function (e) {
      if (e.target.closest('[data-a="tr"]')) { translateSel(); return; }
      var s = getSelection(); if (!s.rangeCount || s.isCollapsed) return; var r = s.getRangeAt(0), m = document.createElement('mark'); m.className = 'hl';
      var frag = r.extractContents(); $$('[id]', frag).forEach(function (n) { n.removeAttribute('id'); }); m.appendChild(frag); r.insertNode(m); s.removeAllRanges(); this.hidden = true;
    };
  }
  function onSelect() {
    var pop = $('#hlPop'); if (!pop) return; var s = getSelection();
    if (!s.rangeCount || s.isCollapsed || !$('#rdText').contains(s.anchorNode)) { setTimeout(function () { if (pop) pop.hidden = true; }, 150); return; }
    var tr = $('[data-a="tr"]', pop); if (tr) tr.hidden = !(R && R.mode === 'practice' && window.Backend && Backend.mode === 'api' && WORD.test(s.toString().trim()));
    var r = s.getRangeAt(0).getBoundingClientRect(); pop.style.left = (r.left + r.width / 2) + 'px'; pop.style.top = (r.top - 6) + 'px'; pop.hidden = false;
  }
  function onTouch() { setTimeout(onSelect, 350); }

  /* ---------- translate one word with Claude (practice mode, max 6 per paragraph, checked on the server) ---------- */
  var WORD = /^[\p{L}][\p{L}'’-]{0,38}$/u;
  function translateSel() {
    var s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    var word = s.toString().trim(), n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement), sent = el && el.closest('.sent');
    var m = sent && /^s-(\d+)-(p\d+s\d+)$/.exec(sent.id);
    if (!m || !WORD.test(word) || !R.ps[+m[1]]) return;
    var p = R.ps[+m[1]]; $('#hlPop').hidden = true; s.removeAllRanges();
    var sh = $('#sheet'); sh.hidden = false;
    var close = function () { sh.hidden = true; sh.innerHTML = ''; };
    var show = function (inner) { sh.innerHTML = '<div class="sheet-card" role="dialog" aria-modal="true" aria-label="' + esc(word) + '"><span class="eyebrow">' + L('Translation', 'Перевод') + '</span><h3>' + esc(word) + '</h3>' + inner + '</div>'; sh.onclick = function (e) { if (e.target === sh) close(); }; var c = $('#trClose'); if (c) c.onclick = close; };
    show('<p class="muted">…</p>');
    Backend.translate(p.id, m[2], word).then(function (d) {
      show('<p class="num-l" style="font-size:1.9rem;margin:0 0 6px">' + esc(d.ru) + '</p><p class="muted" style="margin:0 0 14px">' + esc(d.def_en) + '</p>' +
        '<p class="eyebrow">' + L(d.left + ' of ' + d.max + ' translations left in this paragraph', 'Осталось переводов в этом абзаце: ' + d.left + ' из ' + d.max) + '</p>' +
        '<div class="q-actions"><button class="btn small" id="trSave">' + L('Save to my words', 'Сохранить в мои слова') + '</button><button class="btn small ghost" id="trClose">' + L('Close', 'Закрыть') + '</button></div>');
      $('#trSave').onclick = function () { A.addToDeck({ word: d.word, def_en: d.def_en, synonym: '', ru: d.ru }); A.toast(L('Added to your review deck', 'Добавлено в колоду')); close(); };
    }).catch(function (e) {
      show('<p class="muted">' + esc(e.message || 'Something went wrong') + '</p><div class="q-actions"><button class="btn small ghost" id="trClose">' + L('Close', 'Закрыть') + '</button></div>');
    });
  }

  /* ---------- practice helps ---------- */
  var TFHINT = { 'TRUE': ['The passage says the same thing in different words.', 'В тексте то же самое, но другими словами.'], 'YES': ['The writer says the same thing in different words.', 'Автор говорит то же самое другими словами.'],
    'FALSE': ['The passage says the opposite.', 'В тексте сказано обратное.'], 'NO': ['The writer says the opposite.', 'Автор говорит обратное.'], 'NOT GIVEN': ['The passage never says this either way.', 'В тексте об этом ничего не сказано.'] };
  function locate(qid) {
    var f = R.qs[qid]; if (!f.q.evidence) { A.toast(L('No location for this one', 'Для этого вопроса нет подсказки')); return; }
    if (f.pi !== R.cur) go(f.pi); $$('.sent.ev').forEach(function (s) { s.classList.remove('ev'); });
    var el = $('#s-' + f.pi + '-' + f.q.evidence); if (!el) return; el.classList.add('ev'); $('#rd').classList.remove('showq'); $('#tSwitch') && ($('#tSwitch').textContent = L('Questions', 'Вопросы'));
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function fb(f, checked, notags) {
    var q = f.q, g = f.g, val = R.vals[q.id] || '', good = checked && ok(q, val), cls = checked ? (good ? 'ok' : 'no') : '';
    var h = '<div class="fb ' + cls + '"><div class="fh"><b>' + q.n + (q.n2 ? '–' + q.n2 : '') + '</b>';
    if (checked) { h += '<b class="v">' + (good ? L('Correct', 'Верно') : val ? L('Not quite', 'Не совсем') : L('No answer', 'Нет ответа')) + '</b>'; if (!good) h += '<span>' + L('Answer', 'Ответ') + ': <b>' + esc(ansLabel(g, q)) + '</b></span>'; }
    h += '</div>';
    if (checked && TFHINT[q.answer]) h += '<div class="muted">' + esc(L(TFHINT[q.answer][0], TFHINT[q.answer][1])) + '</div>';
    if (checked && q.explanation) h += '<p style="margin:6px 0 0">' + A.tx(q.explanation) + '</p>';
    if (checked && q.evidence) h += '<blockquote>' + esc(sentText(f.p, q.evidence)) + '</blockquote>';
    h += '<div class="chips">' + ((q.anchors || []).length ? '<span class="lbl">' + L('Anchors', 'Якоря') + '</span>' + q.anchors.map(function (a) { return '<span class="chip a">' + esc(a) + '</span>'; }).join('') : '') +
      (q.where ? '<span class="lbl">→ ' + esc(q.where) + '</span>' : '') + (q.evidence ? '<button type="button" class="btn small ghost" data-loc="' + q.id + '">' + L('Locate', 'Найти в тексте') + '</button>' : '') + '</div>';
    if (q.conf === 'low') h += '<div class="muted" style="margin-top:6px;font-size:12.5px">' + L('Located automatically. Double-check this one against the passage.', 'Найдено автоматически. Перепроверь по тексту.') + '</div>';
    if (checked && !notags && !good && val) h += '<div class="chips"><span class="lbl">' + L('What went wrong?', 'Что пошло не так?') + '</span>' + [['notfind', "Couldn't find it", 'Не нашёл(а)'], ['misread', 'Misread it', 'Неверно прочитал(а)'], ['time', 'Ran out of time', 'Не хватило времени']].map(function (c) {
      return '<button type="button" class="tag" data-q="' + q.id + '" data-cause="' + c[0] + '" aria-pressed="' + (R.cause[q.id] === c[0]) + '">' + L(c[1], c[2]) + '</button>'; }).join('') + '</div>';
    return h + '</div>';
  }
  function groupOf(sec) { var pi = +sec.dataset.pi; return R.ps[pi].groups.filter(function (g) { return g.id === sec.dataset.g; })[0]; }
  function hint(sec) { var g = groupOf(sec), feed = $('.feed', sec); if (feed.dataset.kind === 'hint') { feed.innerHTML = ''; feed.dataset.kind = ''; return; } feed.dataset.kind = 'hint'; feed.innerHTML = g.questions.map(function (q) { return fb(R.qs[q.id], false); }).join(''); }
  function check(sec) {
    var g = groupOf(sec), feed = $('.feed', sec); feed.dataset.kind = 'check';
    g.questions.forEach(function (q) {
      var val = R.vals[q.id] || '', good = ok(q, val), els = $$('[data-q="' + q.id + '"]', sec);
      els.forEach(function (el) { if (el.classList.contains('opts')) $$('.opt', el).forEach(function (b) { var on = (val ? val.split(',') : []).indexOf(b.dataset.v) >= 0, right = (isMulti(q) ? q.answer : [q.answer]).indexOf(b.dataset.v) >= 0; b.classList.toggle('right', right); b.classList.toggle('wrong', on && !right); }); else if (!el.dataset.cause) { el.classList.toggle('right', good); el.classList.toggle('wrong', !good && !!val); } });
    });
    feed.innerHTML = g.questions.map(function (q) { return fb(R.qs[q.id], true); }).join('');
  }

  /* ---------- submit + results ---------- */
  function submit(auto) {
    if (R.done) return;
    var blank = R.order.filter(function (id) { return !R.vals[id]; }).length;
    if (!auto && blank && !confirm(L(blank + ' question(s) are still empty. Submit anyway?', 'Пустых вопросов: ' + blank + '. Всё равно сдать?'))) return;
    R.done = true; clearInterval(R.timer);
    var secs = Math.round((Date.now() - R.t0) / 1000), recs = [], score = 0, total = 0;
    R.order.forEach(function (id) {
      var f = R.qs[id], val = R.vals[id] || '', m = marks(f.q, val); score += m; total += f.q.marks || 1;
      recs.push({ attemptId: R.attemptId, passageId: f.p.id, questionId: id, qtype: f.g.type, correct: ok(f.q, val), given: val || '(blank)', secs: 0, cause: R.cause[id] || null, evidence: null, wordsMattered: null, ts: Date.now() });
    });
    var st = A.computeStats(recs);
    A.S.answers = A.S.answers.concat(recs);
    A.S.state.attempts.push({ id: R.attemptId, passageId: R.scope === 'all' ? 'test-' + R.T : R.ps[0].id, ts: Date.now(), score: score, total: total, secs: secs, mode: R.mode, byType: st.types.map(function (t) { return { type: t.type, n: t.n, right: t.right }; }) });
    A.persist();
    var queue = recs.slice(), next = function () { var b = queue.splice(0, 6); if (!b.length) return; Promise.all(b.map(function (r) { return Backend.saveAnswer(r).catch(function () { A.toast(L('Could not save some answers. Check your connection.', 'Не удалось сохранить часть ответов.')); }); })).then(next); }; next();
    results(score, total, secs, st);
  }
  function results(score, total, secs, st) {
    var wrong = [], right = []; R.order.forEach(function (id) { var f = R.qs[id]; (marks(f.q, R.vals[id] || '') === (f.q.marks || 1) ? right : wrong).push(f); });
    var row = function (f) { return fb(f, true, true); };
    var head = (+R.T ? L('Test ', 'Тест ') + R.T : L('Sample', 'Пробный текст')) + ' · ' + (R.mode === 'exam' ? L('Exam', 'Экзамен') : L('Practice', 'Практика'));
    var el = document.createElement('div'); el.className = 'res';
    el.innerHTML = '<div class="in"><span class="eyebrow">' + esc(head) + '</span><div class="row" style="gap:32px;margin-top:18px">' + A.bigRing(A.pct(score, total)) + '<div><div class="num-xl">' + score + '<small>/ ' + total + '</small></div><p class="muted" style="margin:6px 0 0">' + A.fmtDur(secs) + (total === 40 ? ' · ' + L('Estimated band', 'Примерный балл') + ' ' + band(score) : '') + '</p></div></div>' +
      '<section class="block"><span class="eyebrow">' + L('By question type', 'По типам вопросов') + '</span>' + A.typeBars(st, false) + '</section>' +
      '<section class="block"><span class="eyebrow">' + L('To review', 'Повторить') + ' (' + wrong.length + ')</span><div class="tbl">' + (wrong.map(row).join('') || '<p class="muted">' + L('Nothing. A clean sheet.', 'Ничего. Чистый лист.') + '</p>') + '</div></section>' +
      (right.length ? '<details class="block"><summary class="eyebrow" style="cursor:pointer">' + L('Correct', 'Верно') + ' (' + right.length + ')</summary><div class="tbl">' + right.map(row).join('') + '</div></details>' : '') +
      '<div class="row" style="margin-top:34px"><a class="btn" href="#/">' + L('Back to practice', 'К практике') + '</a><a class="btn ghost" href="#/progress">' + L('Progress', 'Прогресс') + '</a></div></div>';
    $('#rd').appendChild(el); el.addEventListener('click', function (e) { var l = e.target.closest('[data-loc]'); if (l) { el.hidden = true; locate(l.dataset.loc); var back = document.createElement('button'); back.className = 'btn small accent'; back.textContent = L('Back to results', 'К результатам'); back.style.cssText = 'position:fixed;right:16px;bottom:70px;z-index:95'; back.onclick = function () { el.hidden = false; back.remove(); }; $('#rd').appendChild(back); } });
    A.animateBars(); el.scrollTop = 0;
  }

  function stop() { if (R) clearInterval(R.timer); R = null; document.removeEventListener('mouseup', onSelect); document.removeEventListener('touchend', onTouch); }

  A.Views.read = function (app, arg, h) {
    var T = h[1] || '0', scope = h[2] || '1', mode = h[3] === 'exam' ? 'exam' : 'practice';
    return Backend.listPassages().then(function (list) {
      var parts = list.filter(function (p) { return (p.test || 0) === +T; }).sort(function (a, b) { return a.part - b.part; });
      if (scope !== 'all') parts = parts.slice(+scope - 1, +scope);
      if (!parts.length) throw new Error('That passage was not found.');
      return Promise.all(parts.map(function (p) { return Backend.getPassage(p.id); }));
    }).then(function (ps) { start(app, T, scope, mode, ps); });
  };
  window.Reader = { stop: stop };
})();
