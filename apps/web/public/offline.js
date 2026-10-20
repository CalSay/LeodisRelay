/* No server data or credentials are cached here. All text is rendered as text.
 *
 * The offline page (FE-3e). The service worker keeps this file and
 * offline.html, so it opens when RELAY is started with no signal. It works on
 * the same device stores as the app (lib/localDraft.ts, lib/localMedia.ts):
 * an engineer can start a site update or an inspection, add cards and
 * photographs or answer the checks, and change any report already held on
 * this phone. The inspections' checks come from the app, which leaves them
 * here while it has signal (lib/offlineStart.ts `offlineTypes`). What is typed here is marked
 * `heldOffline`, and a report started here carries `started`; the app sends
 * both by itself the next time it opens with signal (lib/heldSend.ts). */
(() => {
  const $ = id => document.getElementById(id);
  const status = $('status'), error = $('error'), editor = $('editor');
  let dirty = false;
  let chain = Promise.resolve();
  let selected;
  let blocked = false;
  const urls = [];
  // The tab's own signed-in person first; otherwise the person the app last
  // left on this device (cleared when they sign out), so a cold start works.
  let person = null;
  try { person = JSON.parse(localStorage.getItem('relay-offline-person') || 'null'); } catch {}
  let principal = null;
  try { principal = sessionStorage.getItem('relay-offline-principal'); } catch {}
  principal = principal || person?.id || null;
  const KINDS = [
    ['update', 'Progress', 'Work done or progressed'],
    ['defect', 'Defect', 'Something wrong to put right'],
    ['instruction', 'Variation', 'Extra work needing instruction'],
    ['access', 'Access', 'Work blocked by others'],
  ];
  const kindName = type => type === 'check' ? 'Check' : (KINDS.find(k => k[0] === type) || KINDS[0])[1];
  // A copy set aside while the engineer chose between two versions shares its
  // report with the ordinary copy, so it is named apart and never opened first.
  const aside = d => d.key.includes('::aside::');
  // The checklist types (lib/reportTypes.ts), as the app last left them on this
  // phone. A handover inspection's actions raise issues, so each says where.
  let types = [];
  try { types = JSON.parse(localStorage.getItem('relay-offline-types') || '[]'); } catch {}
  types = Array.isArray(types) ? types.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.checklist) && t.checklist.length
    && t.checklist.every(c => c && typeof c.item === 'string' && typeof c.question === 'string')) : [];
  const TYPE_NAMES = { 'safety-inspection': 'Safety inspection', 'handover-inspection': 'Handover inspection' };
  for (const t of types) TYPE_NAMES[t.id] = t.name;
  const typeOf = d => d.report?.reportType || d.started?.reportType;
  const inspection = d => Boolean(TYPE_NAMES[typeOf(d)]) || d.observations.some(o => o.check);
  const typeName = d => TYPE_NAMES[typeOf(d)] || (inspection(d) ? 'Inspection' : 'Site update');
  const raisesIssues = d => { const t = types.find(x => x.id === typeOf(d)); return t ? t.raisesIssues === true : typeOf(d) === 'handover-inspection'; };
  const hintFor = (d, item) => types.find(x => x.id === typeOf(d))?.checklist.find(c => c.item === item)?.hint || '';
  const label = d => d.started ? `New ${typeName(d).toLowerCase()} · ${d.started.projectName}`
    : `${d.report?.reference || d.reportId}${aside(d) ? ' (copy kept while choosing between two versions)' : ''}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const photos = d => d.observations.reduce((n, o) => n + o.photos.length, 0);
  // "4 of 12 checks answered" for an inspection, "3 cards" for a site update.
  const cards = d => inspection(d) ? `${d.observations.filter(o => o.check?.answer).length} of ${plural(d.observations.length, 'check')} answered` : plural(d.observations.length, 'card');
  const when = iso => { try { return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const day = iso => { try { return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { return iso; } };
  const fail = e => { error.textContent = e?.message || 'This phone’s storage is not available. Keep this page open.'; };
  const uuid = () => {
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const localDay = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // The same stores, versions and upgrades as the app, so either can create them first.
  function openDrafts() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('relay-drafts', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains('unsent')) db.deleteObjectStore('unsent');
        db.createObjectStore('unsent', { keyPath: 'key' });
      };
      request.onerror = () => reject(new Error('This phone will not let RELAY keep work on it.'));
      request.onblocked = () => reject(new Error('RELAY is open in another tab with an older version. Close it and try again.'));
      request.onsuccess = () => resolve(request.result);
    });
  }
  function media(mode, work) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('relay-media', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('blobs');
      request.onerror = () => reject(new Error('Photos cannot be kept on this phone.'));
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('blobs', mode); const r = work(tx.objectStore('blobs'));
        tx.oncomplete = () => { db.close(); resolve(r?.result); };
        tx.onabort = () => { db.close(); reject(tx.error?.name === 'QuotaExceededError' ? new Error('This phone is out of storage space.') : new Error('The photo could not be kept on this phone.')); };
      };
    });
  }
  async function allDrafts() {
    const db = await openDrafts();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('unsent', 'readonly');
      const request = tx.objectStore('unsent').getAll();
      tx.oncomplete = () => { db.close(); resolve(request.result.filter(d => d.principalId === principal).sort((a, b) => b.heldAt.localeCompare(a.heldAt))); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  async function put(record) {
    const db = await openDrafts();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('unsent', 'readwrite'); tx.objectStore('unsent').put(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error?.name === 'QuotaExceededError' ? new Error('This phone is out of storage space.') : new Error('This could not be kept on this phone.')); };
    });
  }
  async function save() {
    if (blocked || !selected) return;
    const current = selected;
    const snapshot = structuredClone(current);
    const editId = uuid();
    const db = await openDrafts();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('unsent', 'readwrite');
      const store = tx.objectStore('unsent');
      const request = store.get(snapshot.key);
      request.onsuccess = () => {
        if (!request.result || request.result.seq !== snapshot.seq) { tx.abort(); return; }
        snapshot.seq = editId; snapshot.heldAt = new Date().toISOString();
        if (snapshot.report) snapshot.report.observations = snapshot.observations;
        // Typed here, so no editor holds it: the app sends it by itself.
        if (!snapshot.started) snapshot.heldOffline = true;
        delete snapshot.sending;
        store.put(snapshot);
      };
      tx.oncomplete = () => { db.close(); current.seq = editId; current.heldAt = snapshot.heldAt; resolve(); };
      tx.onabort = () => { db.close(); reject(new Error('This report changed in another tab, or this phone’s storage failed. Your changes are still on screen: export a copy before closing.')); };
    });
  }
  function changed() {
    dirty = true; status.textContent = 'Saving on this phone…';
    chain = chain.then(save).then(() => {
      if (!blocked) { status.textContent = `Saved on this phone ${when(new Date().toISOString())}. Not on the server yet.`; void list(); }
    }).catch(e => { blocked = true; fail(e); });
    const last = chain;
    last.then(() => { if (chain === last && !blocked) dirty = false; });
  }
  function element(tag, text, parent, className) {
    const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; if (parent) parent.append(node); return node;
  }
  async function preview(photo) {
    const thumb = await media('readonly', s => s.get(`thumb:${photo.id}`));
    return thumb || media('readonly', s => s.get(photo.id));
  }
  async function showPhoto(photo, index, observation, parent) {
    const box = element('div', '', parent, 'shot');
    try {
      const blob = await preview(photo);
      if (blob) { const url = URL.createObjectURL(blob); urls.push(url); const image = element('img', '', box); image.src = url; image.alt = photo.caption || `Photo ${index + 1}`; }
      else element('p', 'On the server, not kept on this phone.', box, 'hint');
    } catch { element('p', 'Not available on this phone.', box, 'hint'); }
    const remove = element('button', 'Remove', box, 'quiet danger'); remove.type = 'button';
    remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
    remove.onclick = () => {
      if (!confirm('Remove this photo from the card?')) return;
      observation.photos = observation.photos.filter(p => p.id !== photo.id); changed(); render();
    };
  }
  // The same checks and copies as the app's capture (lib/localMedia.ts).
  async function capture(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
    const id = uuid();
    await media('readwrite', s => s.put(file, id));
    if (typeof createImageBitmap === 'function') {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const thumb = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
          if (thumb) await media('readwrite', s => s.put(thumb, `thumb:${id}`));
        }
      } catch { /* The original is kept and is what goes up. */ } finally { bitmap?.close?.(); }
    }
    return { id, dataUrl: `/api/media/${id}`, caption: '', capturedAt: new Date().toISOString() };
  }
  function field(section, observation, key, title, multiline) {
    const label = element('label', title, section, 'field');
    const input = element(multiline ? 'textarea' : 'input', '', label);
    input.value = observation[key] || '';
    input.oninput = () => { observation[key] = input.value; changed(); };
    return input;
  }
  const WORDS = {
    update: [['whatHappened', 'What happened']],
    defect: [['whatHappened', 'What’s wrong'], ['actionNeeded', 'What needs doing'], ['owner', 'Who needs to respond']],
    instruction: [['whatHappened', 'What extra work, and why'], ['actionNeeded', 'What needs doing'], ['owner', 'Who needs to respond']],
    access: [['whatHappened', 'What was blocked, and by whom'], ['actionNeeded', 'What needs doing'], ['owner', 'Who needs to respond']],
  };
  function card(observation, index, fixed, raises, hint) {
    const section = element('section', '', editor, 'card');
    section.setAttribute('aria-label', `Card ${index + 1}`);
    const head = element('div', '', section, 'cardhead');
    element('span', kindName(observation.type), head, `kind ${observation.type}`);
    const check = observation.check;
    element('h3', check ? `${check.question}${observation.location ? ` · ${observation.location}` : ''}` : observation.location || `Card ${index + 1}`, head);
    element('span', 'Only on this phone', head, 'where');
    if (check && hint) element('p', hint, section, 'qhint');
    if (check) {
      // An inspection's check: its answer can be changed here; the question cannot.
      const label = element('label', 'Answer', section, 'field'); const answer = element('select', '', label);
      for (const [value, title] of [['', 'Not answered'], ['ok', 'Satisfactory'], ['action', 'Action needed'], ['na', 'Not applicable']]) { const option = element('option', title, answer); option.value = value; }
      answer.value = check.answer ?? '';
      // As in the app's check editor: moving off "Action needed" clears what, who and where.
      answer.onchange = () => {
        if (answer.value) check.answer = answer.value; else delete check.answer;
        if (answer.value !== 'action') { observation.actionNeeded = ''; observation.owner = ''; observation.location = ''; }
        changed(); render();
      };
      if (raises && check.answer === 'action') field(section, observation, 'location', 'Where (for the snag list)', false);
      for (const [key, title] of [['whatHappened', 'Notes or what is wrong'], ['actionNeeded', 'What needs doing'], ['owner', 'Who is to do it']]) field(section, observation, key, title, key !== 'owner');
    } else {
      if (!fixed) {
        const label = element('label', 'Kind', section, 'field'); const kind = element('select', '', label);
        for (const [value, title] of KINDS) { const option = element('option', title, kind); option.value = value; }
        kind.value = observation.type;
        kind.onchange = () => { observation.type = kind.value; changed(); render(); };
      }
      const where = field(section, observation, 'location', 'Where', false);
      where.addEventListener('input', () => { section.querySelector('h3').textContent = where.value || `Card ${index + 1}`; });
      const words = WORDS[observation.type] || WORDS.update;
      for (const [key, title] of words) field(section, observation, key, title, key !== 'owner');
      // Older words on a progress card are kept and shown, never hidden.
      if (observation.type === 'update') for (const [key, title] of [['actionNeeded', 'Action needed'], ['owner', 'Owner']]) if (observation[key]) field(section, observation, key, title, key !== 'owner');
    }
    const shots = element('div', '', section, 'shots');
    observation.photos.forEach((p, i) => void showPhoto(p, i, observation, shots));
    const acts = element('div', '', section, 'cardacts');
    const add = element('label', '', acts, 'btn'); element('span', observation.photos.length ? 'Add another photo' : 'Add a photo', add);
    const input = element('input', '', add); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.multiple = true; input.setAttribute('capture', 'environment');
    input.setAttribute('aria-label', `Add a photo to card ${index + 1}`);
    input.onchange = async () => {
      const files = Array.from(input.files || []); input.value = '';
      for (const file of files) {
        try { observation.photos.push(await capture(file)); changed(); }
        catch (e) { fail(e); }
      }
      render();
    };
    if (!check && !fixed) {
      const remove = element('button', 'Remove card', acts, 'quiet danger'); remove.type = 'button';
      remove.setAttribute('aria-label', `Remove card ${index + 1}`);
      remove.onclick = () => {
        if (!confirm('Remove this card and its photos from the report?')) return;
        selected.observations.splice(index, 1); changed(); render();
      };
    }
  }
  function render() {
    urls.splice(0).forEach(URL.revokeObjectURL); editor.replaceChildren();
    if (!selected) return;
    const d = selected;
    const panel = element('div', '', editor, 'panel');
    editor.append(panel);
    const head = element('div', '', panel, 'edhead');
    const titles = element('div', '', head);
    element('p', d.started ? 'Started on this phone' : typeName(d), titles, 'lbl');
    element('h2', label(d), titles).id = 'editor-title';
    element('span', 'Only on this phone', head, 'tag');
    const counts = `${cards(d)} · ${plural(photos(d), 'photo')}`;
    element('p', d.started ? `Visit ${day(d.started.visitDate)} · ${counts} · gets its reference when it reaches the server` : `${d.report?.projectSnapshot?.projectName ? `${d.report.projectSnapshot.projectName} · ` : ''}${counts}`, panel, 'hint');
    // An inspection is signed in RELAY: the drawn signature is taken there, with signal.
    if (d.started && inspection(d)) element('p', 'Answer what you can here. You sign it in RELAY when there is signal, and it is not sent until you do.', panel, 'hint');
    if (d.problem) element('p', `Last time it could not go to the server: ${d.problem}`, panel, 'danger');
    if (!d.started && !Number.isInteger(d.baseVersion)) element('p', 'This older copy has no save version. Export it to compare: RELAY will not overwrite the server’s copy with it.', panel, 'hint');
    const fixed = inspection(d);
    const target = editor;
    d.observations.forEach((o, i) => card(o, i, fixed, raisesIssues(d), o.check ? hintFor(d, o.check.item) : ''));
    if (!d.observations.length) element('p', d.started ? 'No cards yet. Add the first one below.' : 'No cards in this report yet.', target, 'empty');
    if (!fixed) {
      const adds = element('section', '', target, 'panel'); adds.setAttribute('aria-labelledby', 'add-title');
      element('h2', 'Add a card', adds).id = 'add-title';
      const grid = element('div', '', adds, 'adds');
      for (const [type, title, hint] of KINDS) {
        const b = element('button', '', grid); b.type = 'button'; element('strong', title, b); element('small', hint, b);
        b.onclick = () => {
          d.observations.push({ id: uuid(), type, location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [] });
          changed(); render();
          const cards = editor.querySelectorAll('.card'); cards[cards.length - 1]?.querySelector('input:not([type=file]),textarea')?.focus();
        };
      }
    }
    const foot = element('div', '', target, 'foot');
    const download = element('button', 'Export a copy', foot); download.type = 'button';
    download.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'relay-held-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (d.started) {
      const discard = element('button', 'Delete this report from the phone', foot, 'quiet danger'); discard.type = 'button';
      discard.onclick = async () => {
        if (!confirm('Delete this report and its cards from this phone? It has not reached the server, so it cannot be got back.')) return;
        await chain;
        try {
          const db = await openDrafts();
          await new Promise((resolve, reject) => { const tx = db.transaction('unsent', 'readwrite'); tx.objectStore('unsent').delete(d.key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); }; });
          // Its photos never reached the server, so they go too: nothing of it stays on the phone.
          const ids = d.observations.flatMap(o => o.photos.map(p => p.id));
          if (ids.length) await media('readwrite', store => { for (const id of ids) { store.delete(id); store.delete(`thumb:${id}`); store.delete(`uploaded:${id}`); } }).catch(() => undefined);
          selected = undefined; render(); status.textContent = 'Deleted from this phone.'; void list();
        } catch (e) { fail(e); }
      };
    } else {
      const link = element('a', 'Open it in RELAY when there is signal', foot); link.href = `/reports/${encodeURIComponent(d.reportId)}`;
    }
  }
  async function show(draft) {
    await chain;
    if (dirty || blocked) { fail(new Error('Export your unsaved changes before switching reports.')); return; }
    error.textContent = ''; selected = structuredClone(draft); render(); void list();
    status.textContent = `Saved on this phone${draft.heldAt ? ` ${when(draft.heldAt)}` : ''}. Not on the server yet.`;
    $('editor-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function list() {
    const drafts = await allDrafts();
    const nav = $('drafts'); nav.replaceChildren();
    $('held').hidden = false;
    if (!drafts.length) element('p', $('start').hidden ? 'Nothing is waiting on this phone.' : 'Nothing is waiting on this phone. Start a report above.', nav, 'empty');
    for (const d of drafts) {
      const b = element('button', '', nav, 'item'); b.type = 'button';
      if (selected?.key === d.key) b.setAttribute('aria-current', 'true');
      const text = element('span', '', b);
      element('span', label(d), text, 't');
      element('span', `${d.started ? `Visit ${day(d.started.visitDate)}` : typeName(d)} · ${cards(d)} · ${plural(photos(d), 'photo')} · changed ${when(d.heldAt)}`, text, 's');
      element('span', 'Only on this phone', b, 'tag');
      b.onclick = async () => { const fresh = (await allDrafts()).find(x => x.key === d.key); if (fresh) await show(fresh); };
    }
    return drafts;
  }
  function startForm() {
    let projects = [];
    try { projects = JSON.parse(localStorage.getItem(`relay-offline-projects:${principal}`) || '[]'); } catch {}
    if (!Array.isArray(projects) || !projects.length) return;
    let current = null; try { current = localStorage.getItem(`relay-project:${principal}`); } catch {}
    const select = $('start-project');
    for (const p of projects) { const o = element('option', `${p.projectName} · ${p.projectNumber}`, select); o.value = p.id; }
    if (projects.some(p => p.id === current)) select.value = current;
    const date = $('start-date'); date.value = localDay(); date.max = localDay(); date.min = localDay(-30);
    // A site update, or one of the inspections the app left on this phone.
    const choices = [{ id: 'progress', name: 'Site update', blurb: 'Progress, defects, variations and access, one card at a time' }, ...types];
    if (types.length) {
      $('start-title').textContent = 'Start a report';
      $('start-types').hidden = false;
      for (const [i, t] of choices.entries()) {
        const choice = element('label', '', $('start-choices'), 'choice');
        const radio = element('input', '', choice); radio.type = 'radio'; radio.name = 'start-type'; radio.value = t.id; radio.checked = i === 0;
        const words = element('span', '', choice); element('strong', t.name, words); if (t.blurb) element('small', t.blurb, words);
      }
    }
    $('start').hidden = false;
    $('start-go').onclick = async () => {
      const project = projects.find(p => p.id === select.value);
      if (!project) return;
      const chosen = document.querySelector('input[name="start-type"]:checked')?.value || 'progress';
      const type = types.find(t => t.id === chosen);
      if (!date.value || date.value > date.max || date.value < date.min) { fail(new Error('Choose a visit date in the last 30 days.')); return; }
      await chain;
      if (dirty || blocked) { fail(new Error('Export your unsaved changes before starting another report.')); return; }
      const clientKey = uuid();
      // An inspection starts with every check, unanswered, as the server starts one (startingCards).
      const observations = type ? type.checklist.map(c => ({ id: `obs-check-${c.item}`, type: 'check', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], check: { item: c.item, question: c.question } })) : [];
      const record = { key: `${principal}::new::${clientKey}`, reportId: `new:${clientKey}`, principalId: principal, seq: uuid(), observations, heldAt: new Date().toISOString(),
        started: { clientKey, projectId: project.id, projectName: project.projectName, projectNumber: project.projectNumber, visitDate: date.value, startedAt: new Date().toISOString(), ...(type ? { reportType: type.id } : {}) } };
      try { await put(record); await show(record); status.textContent = type ? 'Started on this phone. Answer the first check.' : 'Started on this phone. Add your first card.'; } catch (e) { fail(e); }
    };
  }
  // Is the server there? `navigator.onLine` says only that a network exists.
  async function probe() {
    let up = false;
    try { up = (await fetch('/api/health', { cache: 'no-store' })).ok; } catch {}
    $('net').textContent = up ? 'Signal back' : 'No signal';
    $('net').classList.toggle('up', up);
    $('back').hidden = !up || !principal;
  }
  window.addEventListener('online', () => void probe());
  setInterval(() => void probe(), 20000);
  void probe();
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  if (!principal) { status.textContent = 'Sign in to RELAY once with signal and this phone can keep your work when there is none. Nobody is signed in on this phone.'; return; }
  if (person?.name && person.id === principal) status.textContent = `Signed in on this phone as ${person.name}.`;
  startForm();
  list().then(drafts => {
    if (!drafts.length && $('start').hidden) status.textContent = 'Nothing is waiting on this phone. Open RELAY with signal once to start reports from here.';
    const id = /^\/reports\/([^/]+)$/.exec(location.pathname)?.[1];
    const match = drafts.find(d => d.reportId === id && !aside(d)) || drafts.find(d => d.reportId === id);
    if (match) void show(match);
  }).catch(fail);
})();
