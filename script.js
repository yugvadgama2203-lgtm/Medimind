/* MediMind – medicine reminder (front-end demo, data stored in localStorage) */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };
  const dayKey = d => d.toLocaleDateString('en-CA');          // YYYY-MM-DD (local time)
  const nowHM = () => new Date().toTimeString().slice(0, 5);   // HH:MM
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => { const [h, m] = t.split(':'); return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`; };
  const TIPS = [
    'Take medicines at the same time each day to build a habit.',
    'Keep a glass of water next to your pill box.',
    'Never double a dose to make up for a missed one without asking your doctor.',
    'Store medicines in a cool, dry place away from sunlight.',
    'Check expiry dates every month and refill before you run out.',
    'Bring this list to your next doctor visit.'
  ];

  let session = ls.get('mm_session', null);
  let data = null;
  const notified = new Set();
  let timer = null;

  const users = () => ls.get('mm_users', {});
  const load = () => { data = ls.get('mm_data_' + session.email, { meds: [], logs: {}, settings: { notify: false, dark: false } }); };
  const save = () => ls.set('mm_data_' + session.email, data);
  const isTaken = (id, day = dayKey(new Date())) => !!(data.logs[day] && data.logs[day][id]);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 3500);
  }

  /* ---------------- AUTH ---------------- */
  $$('.tab').forEach(tab => tab.onclick = () => {
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
    $('#signupForm').classList.toggle('hidden', tab.dataset.tab !== 'signup');
  });

  $('#loginForm').onsubmit = e => {
    e.preventDefault();
    const email = $('#lEmail').value.trim().toLowerCase();
    const u = users()[email];
    if (!u || u.pass !== $('#lPass').value) { $('#lErr').textContent = 'Email or password is incorrect. Check both and try again.'; return; }
    $('#lErr').textContent = '';
    signIn(email, u.name);
  };

  $('#signupForm').onsubmit = e => {
    e.preventDefault();
    const email = $('#sEmail').value.trim().toLowerCase();
    const all = users();
    if (all[email]) { $('#sErr').textContent = 'That email already has an account. Try logging in instead.'; return; }
    all[email] = { name: $('#sName').value.trim(), pass: $('#sPass').value }; // demo only – use a real backend + hashing in production
    ls.set('mm_users', all);
    signIn(email, all[email].name);
  };

  $('#demoBtn').onclick = () => {
    const email = 'demo@medimind.app', all = users();
    if (!all[email]) {
      all[email] = { name: 'Alex', pass: 'demo123' };
      ls.set('mm_users', all);
      const mk = (name, dose, time, note) => ({ id: 'm' + Math.random().toString(36).slice(2, 8), name, dose, time, note });
      ls.set('mm_data_' + email, {
        meds: [mk('Vitamin D', '1 tablet', '08:00', 'with breakfast'), mk('Metformin', '500 mg', '13:00', 'after lunch'), mk('Atorvastatin', '10 mg', '21:00', 'before bed')],
        logs: {}, settings: { notify: false, dark: false }
      });
    }
    signIn(email, all[email].name);
  };

  function signIn(email, name) {
    session = { email, name };
    ls.set('mm_session', session);
    startApp();
  }

  function signOut() {
    localStorage.removeItem('mm_session');
    session = null; data = null;
    clearInterval(timer);
    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
    document.documentElement.removeAttribute('data-theme');
  }
  $('#logoutSide').onclick = signOut;
  $('#logoutBtn').onclick = signOut;

  /* ---------------- APP ---------------- */
  function startApp() {
    load();
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    document.documentElement.setAttribute('data-theme', data.settings.dark ? 'dark' : 'light');
    $('#setName').value = session.name;
    $('#setNotify').checked = data.settings.notify;
    $('#setDark').checked = data.settings.dark;
    $('#tip').textContent = TIPS[new Date().getDate() % TIPS.length];
    showPage('dashboard');
    renderAll();
    clearInterval(timer);
    timer = setInterval(tick, 15000);
  }

  function showPage(p) {
    $$('.nav[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === p));
    $$('.page').forEach(s => s.classList.toggle('active', s.id === 'page-' + p));
    window.scrollTo(0, 0);
  }
  $$('.nav[data-page]').forEach(n => n.onclick = () => showPage(n.dataset.page));

  const sorted = () => [...data.meds].sort((a, b) => a.time.localeCompare(b.time));

  function renderAll() { renderHeader(); renderDashboard(); renderMeds(); renderHistory(); }

  function renderHeader() {
    const h = new Date().getHours();
    $('#greet').textContent = `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${session.name}`;
    $('#dateTxt').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function renderDashboard() {
    const meds = sorted(), now = nowHM();
    const taken = meds.filter(m => isTaken(m.id)).length;
    const overdue = meds.filter(m => !isTaken(m.id) && m.time < now).length;
    const pct = meds.length ? Math.round(taken / meds.length * 100) : 0;

    $('#stats').innerHTML = `
      <div class="stat"><b>${meds.length}</b><span>Doses today</span></div>
      <div class="stat ok"><b>${taken}</b><span>Taken</span></div>
      <div class="stat warn"><b>${meds.length - taken}</b><span>Still to take</span></div>
      <div class="stat bad"><b>${overdue}</b><span>Overdue</span></div>`;

    $('#ring').style.setProperty('--p', pct);
    $('#ringTxt').textContent = pct + '%';

    const next = meds.find(m => !isTaken(m.id) && m.time >= now) || meds.find(m => !isTaken(m.id));
    $('#nextDose').textContent = !meds.length ? 'Add a medicine to get started.'
      : next ? `${next.name} (${next.dose}) at ${fmt(next.time)}` : 'All done for today. Nice work!';

    $('#todayList').innerHTML = meds.length ? meds.map(m => {
      const done = isTaken(m.id), late = !done && m.time < now;
      return `<li class="item ${done ? 'done' : ''}">
        <span class="time">${fmt(m.time)}</span>
        <div class="info"><div class="name">${esc(m.name)} · ${esc(m.dose)}</div>
          <span class="muted">${esc(m.note || 'No notes')}</span></div>
        <span class="chip ${done ? 'ok' : late ? 'bad' : ''}">${done ? 'Taken' : late ? 'Overdue' : 'Upcoming'}</span>
        <button class="btn small ${done ? 'ghost' : ''}" data-toggle="${m.id}">${done ? 'Undo' : 'Mark taken'}</button>
      </li>`;
    }).join('') : '<li class="empty">No medicines yet. Select “Add medicine” to create your first reminder.</li>';
  }

  function renderMeds() {
    $('#medList').innerHTML = data.meds.length ? sorted().map(m => `
      <li class="item">
        <span class="time">${fmt(m.time)}</span>
        <div class="info"><div class="name">${esc(m.name)}</div><span class="muted">${esc(m.dose)} · ${esc(m.note || 'Every day')}</span></div>
        <button class="btn small danger" data-del="${m.id}">Delete</button>
      </li>`).join('') : '<li class="empty">Nothing here yet. Add a medicine to see it listed.</li>';
  }

  function renderHistory() {
    const total = data.meds.length, days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = dayKey(d), log = data.logs[k] || {};
      const n = data.meds.filter(m => log[m.id]).length;
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), pct: total ? Math.round(n / total * 100) : 0 });
    }
    let streak = 0;
    for (let i = days.length - 1; i >= 0 && days[i].pct === 100; i--) streak++;
    const avg = Math.round(days.reduce((s, d) => s + d.pct, 0) / days.length);
    $('#histStats').innerHTML = `
      <div class="stat ok"><b>${avg}%</b><span>Weekly adherence</span></div>
      <div class="stat"><b>${streak}</b><span>Day streak</span></div>
      <div class="stat warn"><b>${total}</b><span>Active medicines</span></div>
      <div class="stat"><b>${days.filter(d => d.pct === 100).length}</b><span>Perfect days</span></div>`;
    $('#bars').innerHTML = days.map(d => `
      <div class="bar"><span>${d.pct}%</span><i class="${d.pct === 0 ? 'zero' : d.pct < 60 ? 'low' : ''}" style="height:${d.pct * 1.4}px"></i><span>${d.label}</span></div>`).join('');
  }

  /* ---------------- ACTIONS ---------------- */
  $('#todayList').onclick = e => {
    const id = e.target.dataset.toggle; if (!id) return;
    const k = dayKey(new Date());
    data.logs[k] = data.logs[k] || {};
    data.logs[k][id] = !data.logs[k][id];
    save(); renderDashboard(); renderHistory();
    if (data.logs[k][id]) toast('Marked as taken. Well done!');
  };

  $('#medList').onclick = e => {
    const id = e.target.dataset.del; if (!id) return;
    data.meds = data.meds.filter(m => m.id !== id);
    save(); renderAll(); toast('Medicine deleted.');
  };

  const modal = $('#modal');
  $('#addBtn').onclick = () => { $('#medForm').reset(); modal.showModal(); };
  $('#cancelBtn').onclick = () => modal.close();
  $('#medForm').onsubmit = e => {
    e.preventDefault();
    data.meds.push({ id: 'm' + Date.now().toString(36), name: $('#mName').value.trim(), dose: $('#mDose').value.trim(), time: $('#mTime').value, note: $('#mNote').value.trim() });
    save(); modal.close(); renderAll(); toast('Medicine saved. You will be reminded daily.');
  };

  /* ---------------- SETTINGS ---------------- */
  $('#saveName').onclick = () => {
    const n = $('#setName').value.trim(); if (!n) return;
    session.name = n; ls.set('mm_session', session);
    const all = users(); if (all[session.email]) { all[session.email].name = n; ls.set('mm_users', all); }
    renderHeader(); toast('Name saved.');
  };

  $('#setDark').onchange = e => {
    data.settings.dark = e.target.checked; save();
    document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
  };

  $('#setNotify').onchange = async e => {
    if (e.target.checked) {
      if (!('Notification' in window)) { e.target.checked = false; toast('This browser does not support notifications.'); return; }
      const p = await Notification.requestPermission();
      if (p !== 'granted') { e.target.checked = false; toast('Notifications are blocked. Allow them in your browser settings.'); return; }
    }
    data.settings.notify = e.target.checked; save();
  };

  $('#exportBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'medimind-data.json'; a.click();
  };

  $('#resetBtn').onclick = () => {
    if (!confirm('Delete all medicines and history? This cannot be undone.')) return;
    data.meds = []; data.logs = {}; save(); renderAll(); toast('All medicines deleted.');
  };

  /* ---------------- REMINDERS ---------------- */
  function tick() {
    if (!session) return;
    const hm = nowHM(), day = dayKey(new Date());
    data.meds.forEach(m => {
      const key = day + m.id;
      if (m.time === hm && !isTaken(m.id) && !notified.has(key)) {
        notified.add(key);
        toast(`⏰ Time to take ${m.name} (${m.dose})`);
        if (data.settings.notify && 'Notification' in window && Notification.permission === 'granted')
          new Notification('MediMind reminder', { body: `${m.name} – ${m.dose}` });
      }
    });
    renderDashboard();
  }

  if (session && users()[session.email]) startApp();
})();
