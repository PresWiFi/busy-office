'use strict';

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const firstName = (p) => p.name.split(' ')[0];
const timeNow = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function avatar(p) {
  const a = h('div', 'avatar', p.name.split(' ').map((w) => w[0]).join(''));
  a.style.background = p.color;
  return a;
}
function sentences(n) {
  const pool = [...C.sentences].sort(() => Math.random() - 0.5);
  return pool.slice(0, n);
}
function press(btn) {
  btn.classList.add('press');
  setTimeout(() => btn.classList.remove('press'), 180);
}

// ---------- sound ----------
const Sound = (() => {
  let ctx;
  const ac = () => (ctx ||= new AudioContext());
  function tone(freq, start, dur, vol = 0.12, type = 'sine') {
    const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fromHz, toHz) {
    const c = ac(), len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    src.buffer = buf;
    f.type = 'bandpass';
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(fromHz, t);
    f.frequency.exponentialRampToValueAtTime(toHz, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }
  const safe = (fn) => (...a) => { try { fn(...a); } catch { /* no audio device */ } };
  return {
    click: safe(() => noise(0.03, 0.15, 3500, 2500)),
    ding: safe(() => { tone(880, 0, 0.4); tone(1320, 0.12, 0.5); }),
    whoosh: safe(() => noise(0.45, 0.4, 400, 4000)),
    pop: safe(() => tone(620, 0, 0.12, 0.12, 'triangle')),
  };
})();

// ---------- typing engine ----------
// Types a list of segments [{el, text, onStart}] a few characters per key press.
const caret = h('span', 'caret');

class Typer {
  constructor(segs) { this.segs = segs; this.i = 0; this.pos = 0; }
  get done() { return this.i >= this.segs.length; }
  step(n) {
    while (n > 0 && !this.done) {
      const s = this.segs[this.i];
      if (!s.node) {
        s.onStart?.();
        s.node = document.createTextNode('');
        s.el.append(s.node);
      }
      if (caret.parentNode !== s.el) s.el.append(caret);
      const take = Math.min(n, s.text.length - this.pos);
      s.node.data += s.text.slice(this.pos, this.pos + take);
      this.pos += take;
      n -= take;
      if (this.pos >= s.text.length) { this.i++; this.pos = 0; }
    }
    return this.done;
  }
}

// ---------- Postbox (mail) ----------
const Mail = {
  id: 'mail', letter: 'P', unread: 0, sent: 0,
  init() {
    for (let i = 0; i < 8; i++) this.addIncoming(false);
    this.newTask();
  },
  addIncoming(unread) {
    const p = pick(C.people), m = h('div', 'msg' + (unread ? ' unread' : ''));
    const meta = h('div', 'meta'), from = h('div', 'from');
    from.append(h('b', null, p.name), h('small', null, timeNow()));
    meta.append(from, h('div', 'subj', pick(C.subjects)), h('div', 'prev', pick(C.sentences)));
    m.append(avatar(p), meta);
    const list = $('mail-list');
    list.prepend(m);
    while (list.children.length > 14) list.lastChild.remove();
    if (unread) $('mail-unread').textContent = ++this.unread;
  },
  newTask() {
    const p = pick(C.people);
    for (const id of ['mail-to', 'mail-subject', 'mail-text']) $(id).textContent = '';
    const body = [
      pick(C.greetings).replace('{n}', firstName(p)), '',
      sentences(rand(1, 3)).join(' '), '',
      pick(C.signoffs), C.me,
    ].join('\n');
    const addr = `${p.name.toLowerCase().replace(' ', '.')}@example.com`;
    this.typer = new Typer([
      { el: $('mail-to'), text: `${p.name} <${addr}>` },
      { el: $('mail-subject'), text: pick(C.subjects) },
      { el: $('mail-text'), text: body },
    ]);
  },
  step(n) { return this.typer.step(n); },
  async finish() {
    caret.remove();
    press($('mail-send'));
    await wait(250);
    Sound.whoosh();
    const compose = $('mail-compose');
    compose.classList.add('sending');
    $('mail-sent').textContent = ++this.sent;
    await wait(500);
    this.newTask();
    compose.classList.remove('sending');
    await wait(500);
    this.addIncoming(true);
    Sound.ding();
    await wait(400);
  },
};

// ---------- Huddle (chat) ----------
const Teams = {
  id: 'teams', letter: 'H',
  init() {
    this.chats = C.people.slice(0, 7).map((p) => ({ p, last: pick(C.chatTheirs) }));
    this.open(0);
    this.newTask();
  },
  renderList() {
    const list = $('chat-list');
    list.textContent = '';
    this.chats.forEach((c, i) => {
      const item = h('div', 'chat-item' + (i === this.cur ? ' active' : '')), meta = h('div', 'meta');
      meta.append(h('div', null, c.p.name), h('div', 'last', c.last));
      item.append(avatar(c.p), meta);
      list.append(item);
    });
  },
  open(i) {
    this.cur = i;
    const c = this.chats[i], head = $('convo-head');
    head.textContent = '';
    head.append(avatar(c.p), h('span', null, c.p.name));
    $('bubbles').textContent = '';
    for (let k = 0; k < 4; k++) {
      const mine = k % 2 === 1;
      this.bubble(mine, pick(mine ? C.chatMine : C.chatTheirs));
    }
    this.renderList();
  },
  bubble(mine, text) {
    const c = this.chats[this.cur], b = h('div', 'bubble' + (mine ? ' mine' : ''));
    b.append(h('small', null, (mine ? '' : c.p.name + '   ') + timeNow()), document.createTextNode(text));
    const box = $('bubbles');
    box.append(b);
    while (box.children.length > 8) box.firstChild.remove();
    c.last = text;
    return b;
  },
  newTask() {
    $('chat-input').textContent = '';
    const text = Math.random() < 0.4 ? `${pick(C.chatMine)} ${pick(C.chatMine)}` : pick(C.chatMine);
    this.typer = new Typer([{ el: $('chat-input'), text }]);
  },
  step(n) { return this.typer.step(n); },
  async finish() {
    caret.remove();
    press($('chat-send'));
    const mine = this.bubble(true, $('chat-input').textContent);
    $('chat-input').textContent = '';
    Sound.pop();
    this.renderList();
    await wait(500);
    $('typing').textContent = `${firstName(this.chats[this.cur].p)} is typing…`;
    await wait(1000);
    $('typing').textContent = '';
    this.bubble(false, pick(C.chatTheirs));
    if (Math.random() < 0.5) mine.append(h('span', 'react', pick(C.reactions)));
    Sound.ding();
    this.renderList();
    if (Math.random() < 0.35) {
      await wait(600);
      this.open((this.cur + rand(1, this.chats.length - 1)) % this.chats.length);
    }
    this.newTask();
  },
};

// ---------- Scribe (documents) ----------
const Word = {
  id: 'word', letter: 'S', docNum: 1,
  init() { this.newDoc(); this.newTask(); },
  newDoc() {
    $('word-page').textContent = '';
    $('word-title').textContent = `Untitled ${this.docNum++} – Scribe`;
    this.paras = 0;
    this.needTitle = true;
  },
  setStyle(name) {
    $('word-style').textContent = name;
    document.querySelector('#word .tool').classList.toggle('on', name !== 'Normal');
  },
  newTask() {
    if (this.paras >= 10) this.newDoc();
    const page = $('word-page'), segs = [];
    const add = (tag, text, style) => {
      const e = h(tag);
      segs.push({ el: e, text, onStart: () => { page.append(e); this.setStyle(style); } });
    };
    if (this.needTitle) { add('h1', pick(C.docTitles), 'Title'); this.needTitle = false; }
    if (this.paras % 2 === 0) add('h2', pick(C.docHeadings), 'Heading 1');
    add('p', sentences(rand(2, 4)).join(' '), 'Normal');
    this.paras++;
    this.typer = new Typer(segs);
  },
  step(n) {
    const done = this.typer.step(n);
    const page = $('word-page'), canvas = $('word-canvas');
    const words = page.textContent.trim().split(/\s+/).filter(Boolean).length;
    $('word-count').textContent = `${words} words`;
    const pages = Math.max(1, Math.ceil(page.scrollHeight / 1000));
    $('word-pages').textContent = `Page ${pages} of ${pages}`;
    canvas.scrollTop = canvas.scrollHeight;
    return done;
  },
  async finish() {
    await wait(300);
    caret.remove();
    this.newTask();
  },
};

// ---------- Tally (spreadsheet) ----------
const Excel = {
  id: 'excel', letter: 'T', ROWS: 30, COLS: 12,
  init() {
    const t = $('xl-grid'), head = h('tr');
    head.append(h('th'));
    for (let c = 0; c < this.COLS; c++) head.append(h('th', null, String.fromCharCode(65 + c)));
    t.append(head);
    this.cells = [];
    for (let r = 0; r < this.ROWS; r++) {
      const tr = h('tr'), row = [];
      tr.append(h('th', null, r + 1));
      for (let c = 0; c < this.COLS; c++) { const td = h('td'); tr.append(td); row.push(td); }
      t.append(tr);
      this.cells.push(row);
    }
    this.newSheet();
    this.newTask();
  },
  newSheet() {
    for (const row of this.cells) for (const td of row) { td.className = ''; td.textContent = ''; }
    const n = C.months.length;
    this.set(0, 0, 'Month', 'hdr');
    C.months.forEach((m, i) => this.set(i + 1, 0, m));
    this.set(n + 1, 0, 'Total', 'total');
    this.col = 1;
  },
  set(r, c, text, cls = '') {
    const td = this.cells[r][c];
    td.className = cls;
    td.textContent = text;
    return td;
  },
  select(r, c, formula) {
    document.querySelectorAll('#xl-grid .sel').forEach((e) => e.classList.remove('sel'));
    const td = this.cells[r][c];
    td.classList.add('sel', 'flash');
    setTimeout(() => td.classList.remove('flash'), 600);
    $('xl-name').textContent = String.fromCharCode(65 + c) + (r + 1);
    $('xl-formula').textContent = formula;
  },
  newTask() {
    if (this.col > 7) this.newSheet();
    const c = this.col++, n = C.months.length, letter = String.fromCharCode(65 + c);
    let total = 0;
    this.queue = [() => { const t = pick(C.sheetHeaders); this.set(0, c, t, 'hdr'); this.select(0, c, t); }];
    for (let i = 0; i < n; i++) {
      this.queue.push(() => {
        const v = rand(5, 120);
        total += v;
        const td = this.set(i + 1, c, '', 'num');
        const bar = h('div', 'bar');
        bar.style.width = `${(v / 120) * 100}%`;
        td.append(bar, h('span', null, v));
        this.select(i + 1, c, String(v));
      });
    }
    this.queue.push(() => {
      this.set(n + 1, c, total, 'total num');
      this.select(n + 1, c, `=SUM(${letter}2:${letter}${n + 1})`);
      Sound.pop();
    });
    this.qi = 0;
  },
  step() {
    this.queue[this.qi++]();
    return this.qi >= this.queue.length;
  },
  async finish() {
    await wait(500);
    this.newTask();
  },
};

// ---------- Bubbles (browser feed) ----------
const Browser = {
  id: 'browser', letter: 'B',
  init() {
    for (let i = 0; i < 8; i++) this.addPost();
    this.newTask();
  },
  fmt: (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)),
  makePost(data, votes) {
    const [sub, title, emoji, bg] = data;
    const post = h('div', 'post'), v = h('div', 'votes'), content = h('div', 'content');
    post.data = data;
    post.votes = votes;
    v.append(h('span', 'up', '▲'), h('span', 'count', this.fmt(votes)), h('span', 'down', '▼'));
    const subline = h('div', 'sub');
    subline.append(h('b', null, `b/${sub}`), document.createTextNode(` · Posted by @${pick(C.people).name.split(' ')[0].toLowerCase()}${rand(1, 999)} · ${rand(1, 23)}h`));
    const thumb = h('div', 'thumb', emoji);
    thumb.style.background = bg;
    const actions = h('div', 'actions');
    actions.append(h('span', null, `💬 ${rand(3, 900)} Comments`), h('span', null, '↗ Share'), h('span', null, '☆ Save'));
    content.append(subline, h('h3', null, title), thumb, actions);
    post.append(v, content);
    return post;
  },
  addPost() { $('rd-feed').append(this.makePost(pick(C.posts), rand(40, 30000))); },
  visiblePost() {
    const feed = $('rd-feed');
    return [...feed.children].find((p) => p.offsetTop + p.offsetHeight / 2 >= feed.scrollTop) || feed.firstChild;
  },
  newTask() {
    this.actions = rand(4, 7);
    this.mode = 'feed';
  },
  step(n) {
    if (this.mode === 'post') return this.typer.step(n);
    const feed = $('rd-feed');
    if (this.actions-- > 0) {
      if (Math.random() < 0.6) {
        feed.scrollTop += 280;
        if (feed.scrollHeight - feed.scrollTop < 2500) { this.addPost(); this.addPost(); }
        this.trim();
      } else {
        const p = this.visiblePost();
        if (!p.classList.contains('voted')) {
          p.classList.add('voted');
          p.querySelector('.count').textContent = this.fmt(++p.votes);
        }
        Sound.pop();
      }
      return false;
    }
    this.openPost(this.visiblePost());
    return false;
  },
  trim() {
    const feed = $('rd-feed');
    if (feed.children.length < 40) return;
    feed.style.scrollBehavior = 'auto';
    let removed = 0;
    for (let i = 0; i < 10; i++) { removed += feed.firstChild.offsetHeight + 12; feed.firstChild.remove(); }
    feed.scrollTop -= removed;
    feed.style.scrollBehavior = '';
  },
  openPost(src) {
    const view = $('rd-post'), [sub] = src.data;
    view.textContent = '';
    const post = this.makePost(src.data, src.votes);
    const box = h('div', 'cmt-box'), input = h('div', 'input'), bar = h('div', 'bar');
    this.sendBtn = h('button', 'send', 'Comment');
    bar.append(this.sendBtn);
    box.append(h('small', null, 'Comment as @me'), input, bar);
    view.append(post, box);
    for (let i = 0; i < 3; i++) this.comment(`@${firstName(pick(C.people)).toLowerCase()}${rand(1, 99)}`, pick(C.comments));
    view.classList.add('open');
    $('br-url').textContent = `bubbles.fun/b/${sub}/comments/${Math.random().toString(36).slice(2, 8)}`;
    this.typer = new Typer([{ el: input, text: pick(C.comments) }]);
    this.input = input;
    this.mode = 'post';
  },
  comment(user, text, first = false) {
    const c = h('div', 'cmt');
    c.append(h('small', null, `${user} · just now`), document.createTextNode(text));
    const view = $('rd-post');
    if (first) view.children[1].after(c); else view.append(c);
  },
  async finish() {
    caret.remove();
    press(this.sendBtn);
    await wait(250);
    this.comment('@me', this.input.textContent, true);
    this.input.textContent = '';
    Sound.pop();
    await wait(1000);
    $('rd-post').classList.remove('open');
    $('br-url').textContent = 'bubbles.fun';
    await wait(300);
    this.newTask();
  },
};

// ---------- desktop shell ----------
const apps = [Mail, Teams, Word, Excel, Browser];
const badges = {};
let current = null;
let busy = false;
let presses = 0;
let lastPress = 0;

function buildTaskbar() {
  for (const a of apps) {
    const sec = $(a.id), btn = h('div', 'tb-app');
    btn.style.setProperty('--accent', sec.style.getPropertyValue('--accent'));
    btn.dataset.app = a.id;
    btn.append(h('span', 'tile', a.letter));
    $('tb-apps').append(btn);
    a.btn = btn;
  }
}

function setBadge(app, n) {
  badges[app.id] = n;
  app.btn.querySelector('.badge')?.remove();
  if (n > 0) app.btn.append(h('span', 'badge', n));
}

function show(app) {
  current = app;
  for (const a of apps) {
    $(a.id).classList.toggle('active', a === app);
    a.btn.classList.toggle('active', a === app);
  }
  setBadge(app, 0);
}

async function switchTo(app) {
  if (app === current) return;
  $(current.id).classList.remove('active');
  await wait(200);
  show(app);
  await wait(300);
}

function toast() {
  const [appId, text] = pick(C.toasts), app = apps.find((a) => a.id === appId), p = pick(C.people);
  const t = h('div', 'toast'), tile = h('span', 'tile', app.letter), body = h('div');
  t.style.setProperty('--accent', $(appId).style.getPropertyValue('--accent'));
  body.append(h('b', null, p.name), h('small', null, text));
  t.append(tile, body);
  $('toasts').append(t);
  Sound.ding();
  if (app !== current) setBadge(app, (badges[app.id] || 0) + 1);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4000);
}

async function onPress() {
  const now = performance.now();
  if (now - lastPress < 40) return; // ignore super-fast key repeat
  lastPress = now;
  Sound.click();
  if (++presses % 35 === 0) toast();
  if (busy) return;
  if (!current.step(rand(3, 6))) return;
  busy = true;
  try {
    await current.finish();
    if (Math.random() < 0.75) await switchTo(pick(apps.filter((a) => a !== current)));
  } finally {
    busy = false;
  }
}

function ripple(x, y) {
  const r = h('div');
  r.id = 'key-ripple';
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  document.body.append(r);
  setTimeout(() => r.remove(), 500);
}

function tickClock() {
  const d = new Date();
  $('clock').innerHTML = '';
  $('clock').append(timeNow(), h('br'), d.toLocaleDateString());
}

// ---------- start ----------
buildTaskbar();
apps.forEach((a) => a.init());
show(Mail);
tickClock();
setInterval(tickClock, 10000);

if (window.desk) window.desk.onKey(onPress);
else addEventListener('keydown', (e) => { e.preventDefault(); onPress(); }); // plain-browser testing

addEventListener('mousedown', (e) => {
  e.preventDefault();
  ripple(e.clientX, e.clientY);
  const tb = e.target.closest('.tb-app');
  if (tb && !busy) {
    Sound.click();
    switchTo(apps.find((a) => a.id === tb.dataset.app));
    return;
  }
  onPress();
});
for (const ev of ['contextmenu', 'dragstart', 'selectstart']) addEventListener(ev, (e) => e.preventDefault());
addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
