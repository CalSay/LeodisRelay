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
 * both by itself the next time it opens with signal (lib/heldSend.ts).
 *
 * Notes for the next visit on the engineer's projects are shown read only, as
 * the app last kept them on this phone (lib/offlineNotes.ts), with when each
 * project's copy was taken.
 *
 * An inspection can be signed here once every check is answered. Signing
 * locks it on this phone and records what was signed (`signedContent`); the
 * app then sends it to the office by itself, but only if it is still exactly
 * what was signed. Taking the signature back unlocks it. */
(() => {
  const $ = id => document.getElementById(id);
  const status = $('status'), error = $('error'), editor = $('editor');
  let dirty = false;
  let chain = Promise.resolve();
  let selected;
  let blocked = false;
  const urls = [];
  // The signature being drawn for the open inspection: kept across redraws, cleared on switching report.
  let strokes = [];
  let signer = '';
  // Drawn, or typed for someone who cannot draw: the name and a ticked statement.
  let signWay = 'draw';
  let typedOk = false;
  let refreshSign = () => {};
  let resize;
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
  // phone. Handover and first fix inspection actions raise issues, so each says where.
  let types = [];
  try { types = JSON.parse(localStorage.getItem('relay-offline-types') || '[]'); } catch {}
  types = Array.isArray(types) ? types.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.checklist) && t.checklist.length
    && t.checklist.every(c => c && typeof c.item === 'string' && typeof c.question === 'string')) : [];
  const TYPE_NAMES = { 'safety-inspection': 'Safety inspection', 'handover-inspection': 'Handover inspection', 'first-fix-inspection': 'First fix inspection', 'tower-inspection': 'Tower inspection' };
  for (const t of types) TYPE_NAMES[t.id] = t.name;
  const typeOf = d => d.report?.reportType || d.started?.reportType;
  const inspection = d => Boolean(TYPE_NAMES[typeOf(d)]) || d.observations.some(o => o.check);
  const typeName = d => TYPE_NAMES[typeOf(d)] || (inspection(d) ? 'Inspection' : 'Site update');
  const raisesIssues = d => { const t = types.find(x => x.id === typeOf(d)); return t ? t.raisesIssues === true : ['handover-inspection', 'first-fix-inspection'].includes(typeOf(d)); };
  const hintFor = (d, item) => types.find(x => x.id === typeOf(d))?.checklist.find(c => c.item === item)?.hint || '';
  // What a tower inspection is of, named when it was started.
  const inspectedOf = d => d.report?.inspected || d.started?.inspected || '';
  const label = d => d.started ? `New ${typeName(d).toLowerCase()}${inspectedOf(d) ? ` of ${inspectedOf(d)}` : ''} · ${d.started.projectName}`
    : `${d.report?.reference || d.reportId}${inspectedOf(d) ? ` · ${inspectedOf(d)}` : ''}${aside(d) ? ' (copy kept while choosing between two versions)' : ''}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  // Ticked to sign by typing a name. Must match TYPED_STATEMENT in lib/signature.ts (tests/typedSignature.test.ts).
  const TYPED_STATEMENT = 'I carried out this inspection and this record is accurate. Typing my name and ticking this box is my signature.';
  // What a signature covers. Must match signedContent in lib/offlineStart.ts (tests/offlineSign.test.ts).
  const signedContent = observations => JSON.stringify(observations.map(o => [o.type, o.check?.item ?? '', o.check?.question ?? '', o.check?.answer ?? '', o.location ?? '', o.whatHappened ?? '', o.actionNeeded ?? '', o.owner ?? '', (o.photos ?? []).map(p => [p.id, p.caption ?? ''])]));
  // An inspection this page can sign: started here, or a draft the server has a version of.
  const signable = d => inspection(d) && !aside(d) && (Boolean(d.started) || Number.isInteger(d.baseVersion));
  const locked = d => Boolean(d?.signed);
  // What stops an inspection being sent, as the server checks it (lib/review.ts reviewInspection).
  function missing(d) {
    const out = [];
    const open = d.observations.filter(o => !o.check?.answer).length;
    if (open) out.push(`${plural(open, 'check')} not answered yet`);
    for (const o of d.observations) if (o.check?.answer === 'action') {
      const q = o.check.question;
      if (!(o.whatHappened || '').trim()) out.push(`${q}: say what is wrong`);
      if (raisesIssues(d) && !(o.location || '').trim()) out.push(`${q}: say where, for the snag list`);
      if (!(o.actionNeeded || '').trim()) out.push(`${q}: say what needs doing`);
    }
    return out;
  }
  const tagFor = d => d.signed ? 'Signed · not sent yet' : 'Only on this phone';
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
        const stored = request.result;
        // A signed copy the app has saved on the server, or is saving now, is on its way: it cannot be taken back here.
        if (!stored || stored.seq !== snapshot.seq || (stored.signed && (Number.isInteger(stored.signed.savedVersion) || (stored.sending && !snapshot.signed)))) { tx.abort(); return; }
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
    refreshSign();
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
    if (locked(selected)) return;
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
    input.disabled = locked(selected);
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
    section.setAttribute('aria-labelledby', `card-title-${index}`);
    const head = element('div', '', section, 'cardhead');
    element('span', kindName(observation.type), head, `kind ${observation.type}`);
    const check = observation.check;
    element('h3', check ? `${check.question}${observation.location ? ` · ${observation.location}` : ''}` : observation.location || `Card ${index + 1}`, head).id = `card-title-${index}`;
    element('span', tagFor(selected), head, 'where');
    if (check && hint) element('p', hint, section, 'qhint');
    if (check) {
      // An inspection's check: its answer can be changed here; the question cannot.
      const label = element('label', 'Answer', section, 'field'); const answer = element('select', '', label);
      for (const [value, title] of [['', 'Not answered'], ['ok', 'Satisfactory'], ['action', 'Action needed'], ['na', 'Not applicable']]) { const option = element('option', title, answer); option.value = value; }
      answer.value = check.answer ?? '';
      answer.disabled = locked(selected);
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
    if (locked(selected)) return;
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
  /*
   * Sign and send. Until every check is answered it lists what is left, as
   * RELAY's check step does. Then the engineer types their name and draws a
   * signature, or (if they cannot draw) ticks a statement that typing their
   * name is their signature; signing locks the inspection on this phone. Signed, it says
   * when it was signed and that it has not been sent, and offers to take the
   * signature back, unless the app has already saved it on the server for sending.
   */
  function signing(d, parent) {
    const box = element('section', '', parent, 'panel sign'); box.setAttribute('aria-labelledby', 'sign-title');
    if (d.signed) {
      element('p', 'Signed on this phone', box, 'lbl');
      element('h2', 'Signed. Not sent yet.', box).id = 'sign-title';
      element('p', `Signed by ${d.signed.name}${d.signed.typed ? ' by typing their name' : ''}, ${when(d.signed.signedAt)}. It goes to the office by itself the next time RELAY opens with signal, and RELAY tells you when it has gone. Until then it is only on this phone.`, box);
      const paper = element('div', '', box, 'signed-ink');
      if (d.signed.typed) { element('p', d.signed.name, paper, 'typed-name'); element('p', `Typed signature: “${TYPED_STATEMENT}”`, paper, 'typed-note'); }
      else { const image = element('img', '', paper); image.src = d.signed.dataUrl; image.alt = `Signature of ${d.signed.name}`; }
      if (Number.isInteger(d.signed.savedVersion)) { element('p', 'It is on its way to the office. Open RELAY with signal to finish sending it.', box, 'hint'); return; }
      const back = element('button', 'Take back signature to change it', box, 'quiet'); back.type = 'button';
      back.onclick = async () => {
        if (blocked || !confirm('Take back your signature? The inspection stays on this phone, unsigned, for you to change and sign again.')) return;
        await chain;
        // Read it again: RELAY in another tab may already be sending it.
        const fresh = (await allDrafts().catch(() => [])).find(x => x.key === selected.key);
        if (!fresh || fresh.seq !== selected.seq || Number.isInteger(fresh.signed?.savedVersion) || fresh.sending) {
          if (fresh) { selected = structuredClone(fresh); render(); }
          status.textContent = fresh && fresh.seq === selected.seq ? 'It is already on its way to the office, so the signature cannot be taken back here. Open RELAY with signal to finish sending it.'
            : 'It has changed or gone from this phone since this page showed it. Look at "On this phone" below, or open RELAY with signal.';
          void list();
          return;
        }
        delete selected.signed;
        try { await commit('Signature taken back. Change what you need, then sign again.'); } catch (e) { blocked = true; fail(e); }
      };
      return;
    }
    element('h2', 'Sign it', box).id = 'sign-title';
    const todo = element('div', '', box);
    const form = element('div', '', box);
    const label = element('label', 'Your name', form, 'field'); const name = element('input', '', label);
    name.value = signer; name.autocomplete = 'name'; name.maxLength = 200;
    // Draw, or type the name for someone who cannot draw (a keyboard or a screen reader, say).
    const way = element('fieldset', '', form, 'types'); element('legend', 'How will you sign?', way, 'siglabel');
    const ways = element('div', '', way, 'choices two');
    const option = (value, title, note) => {
      const l = element('label', '', ways, 'choice'); const r = element('input', '', l); r.type = 'radio'; r.name = 'sign-way'; r.value = value; r.checked = signWay === value;
      const t = element('span', '', l); element('strong', title, t); element('small', note, t);
      r.onchange = () => { signWay = value; strokes = []; typedOk = false; confirmBox.checked = false; showWay(); paint(); refreshSign(); };
    };
    const drawPart = element('div', '', form);
    const typePart = element('div', '', form);
    const confirmLine = element('label', '', typePart, 'choice confirm'); const confirmBox = element('input', '', confirmLine); confirmBox.type = 'checkbox'; confirmBox.checked = typedOk;
    element('span', TYPED_STATEMENT, confirmLine);
    element('p', 'The office and the PDF show it as a typed signature, with this statement and the time it is sent.', typePart, 'hint');
    confirmBox.onchange = () => { typedOk = confirmBox.checked; refreshSign(); };
    option('draw', 'Draw my signature', 'With a finger, pen or mouse.');
    option('type', 'Type my name instead', 'If you can’t draw one: your full name and a tick.');
    const showWay = () => { drawPart.hidden = signWay !== 'draw'; typePart.hidden = signWay !== 'type'; name.parentElement.firstChild.textContent = signWay === 'type' ? 'Your full name' : 'Your name'; };
    element('p', 'Signature', drawPart, 'siglabel');
    const wrap = element('div', '', drawPart, 'sigwrap');
    const canvas = element('canvas', '', wrap, 'sigpad');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Signature: draw it with your finger');
    const prompt = element('span', 'Sign here', wrap, 'sighint');
    const acts = element('div', '', form, 'cardacts');
    const go = element('button', 'Sign it. Send when there is signal', acts, 'primary'); go.type = 'button';
    const clear = element('button', 'Clear', drawPart, 'quiet'); clear.type = 'button'; clear.setAttribute('aria-label', 'Clear signature');
    showWay();
    element('p', 'Signing locks it on this phone. It goes to the office by itself the next time RELAY opens with signal, only if nothing has changed since you signed. To change anything, take your signature back first.', form, 'hint');
    const paint = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1), box = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(box.width * ratio) || canvas.height !== Math.round(box.height * ratio)) { canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio); }
      const c = canvas.getContext('2d'); if (!c) return;
      c.setTransform(ratio, 0, 0, ratio, 0, 0); c.clearRect(0, 0, box.width, box.height);
      draw(c, getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000');
      prompt.hidden = strokes.length > 0;
    };
    const draw = (c, ink) => {
      c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = ink;
      for (const line of strokes) { if (!line.length) continue; c.beginPath(); c.moveTo(line[0].x, line[0].y); for (const p of line.slice(1)) c.lineTo(p.x, p.y); if (line.length === 1) c.lineTo(line[0].x + 0.1, line[0].y); c.stroke(); }
    };
    const at = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    let drawing = false;
    canvas.onpointerdown = e => { canvas.setPointerCapture?.(e.pointerId); drawing = true; strokes.push([at(e)]); paint(); refreshSign(); };
    canvas.onpointermove = e => { if (drawing) { strokes[strokes.length - 1].push(at(e)); paint(); } };
    canvas.onpointerup = canvas.onpointercancel = () => { drawing = false; refreshSign(); };
    clear.onclick = () => { strokes = []; paint(); refreshSign(); };
    name.oninput = () => { signer = name.value; refreshSign(); };
    resize?.disconnect(); resize = new ResizeObserver(paint); resize.observe(canvas);
    refreshSign = () => {
      const left = missing(d);
      todo.replaceChildren();
      form.hidden = left.length > 0;
      if (left.length) {
        element('p', 'Before you can sign, these need doing:', todo);
        const items = element('ul', '', todo, 'todo'); for (const line of left) element('li', line, items);
        element('p', 'A photo, and who is to do each action, are worth adding but do not stop you signing.', todo, 'hint');
      }
      go.disabled = left.length > 0 || !signer.trim() || (signWay === 'type' ? !typedOk : !strokes.length);
    };
    refreshSign();
    go.onclick = async () => {
      if (go.disabled) return;
      await chain;
      if (blocked || missing(selected).length) return;
      if (signWay === 'type') {
        selected.signed = { name: signer.trim(), typed: true, signedAt: new Date().toISOString(), content: signedContent(selected.observations) };
        try { await commit('Signed on this phone. It goes to the office by itself when RELAY opens with signal.'); }
        catch (e) { delete selected.signed; blocked = true; fail(e); }
        return;
      }
      // The PDF needs dark ink on a clear ground, whatever the screen's theme.
      const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
      const c = out.getContext('2d'); if (!c) return;
      const box = canvas.getBoundingClientRect(); c.scale(out.width / box.width, out.height / box.height); draw(c, '#111111');
      const dataUrl = out.toDataURL('image/png');
      const name = signer.trim();
      selected.signed = { name, dataUrl, signedAt: new Date().toISOString(), content: signedContent(selected.observations) };
      // Kept apart from the report's own draft signature: RELAY's editor, if it
      // takes the copy over before it goes, shows it unsigned to be signed there.
      try { await commit('Signed on this phone. It goes to the office by itself when RELAY opens with signal.'); }
      catch (e) { delete selected.signed; blocked = true; fail(e); }
    };
  }
  // Keep a signature, or its taking back, at once, then show the page as it now stands.
  async function commit(message) {
    await save();
    strokes = []; typedOk = false;
    render(); void list();
    status.textContent = message;
    $('sign-title')?.scrollIntoView({ block: 'start' });
  }
  function render() {
    refreshSign = () => {}; resize?.disconnect(); resize = undefined;
    urls.splice(0).forEach(URL.revokeObjectURL); editor.replaceChildren();
    if (!selected) return;
    const d = selected;
    const panel = element('div', '', editor, 'panel');
    editor.append(panel);
    const head = element('div', '', panel, 'edhead');
    const titles = element('div', '', head);
    element('p', d.started ? 'Started on this phone' : typeName(d), titles, 'lbl');
    element('h2', label(d), titles).id = 'editor-title';
    element('span', tagFor(d), head, d.signed ? 'tag signed' : 'tag');
    const counts = `${cards(d)} · ${plural(photos(d), 'photo')}`;
    element('p', d.started ? `Visit ${day(d.started.visitDate)} · ${counts} · gets its reference when it reaches the server` : `${d.report?.projectSnapshot?.projectName ? `${d.report.projectSnapshot.projectName} · ` : ''}${counts}`, panel, 'hint');
    // An inspection can be signed here, at the foot, once every check is answered.
    if (signable(d) && !d.signed) element('p', 'Answer every check, then sign at the foot of the page. It goes to the office by itself the next time RELAY opens with signal.', panel, 'hint');
    if (d.problem) element('p', `${Number.isInteger(d.signed?.savedVersion) ? 'Last time it could not be sent to the office' : 'Last time it could not go to the server'}: ${d.problem}`, panel, 'danger');
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
    if (signable(d)) signing(d, target);
    const foot = element('div', '', target, 'foot');
    const download = element('button', 'Export a copy', foot); download.type = 'button';
    download.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'relay-held-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (d.signed) {
      const link = element('a', 'Open RELAY to send it now', foot); link.href = '/engineer';
    } else if (d.started) {
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
    error.textContent = ''; selected = structuredClone(draft); strokes = []; typedOk = false; signWay = 'draw'; signer = draft.signed?.name || person?.name || ''; render(); void list();
    status.textContent = `Saved on this phone${draft.heldAt ? ` ${when(draft.heldAt)}` : ''}. Not on the server yet.`;
    // Focus follows the report just opened, so a keyboard or screen reader starts there too.
    const title = $('editor-title'); if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); title.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
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
      element('span', tagFor(d), b, d.signed ? 'tag signed' : 'tag');
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
        radio.onchange = () => inspects();
        const words = element('span', '', choice); element('strong', t.name, words); if (t.blurb) element('small', t.blurb, words);
      }
    }
    // A type about one thing (a tower inspection's tower) asks for its name before it starts.
    const chosenType = () => types.find(t => t.id === (document.querySelector('input[name="start-type"]:checked')?.value || 'progress'));
    function inspects() {
      const about = chosenType()?.inspects;
      $('start-inspects').hidden = !about;
      if (!about) return;
      $('start-inspects-label').textContent = about.label;
      $('start-inspected').placeholder = about.placeholder || '';
      $('start-inspects-hint').textContent = about.hint || '';
    }
    inspects();
    $('start').hidden = false;
    $('start-go').onclick = async () => {
      const project = projects.find(p => p.id === select.value);
      if (!project) return;
      const chosen = document.querySelector('input[name="start-type"]:checked')?.value || 'progress';
      const type = types.find(t => t.id === chosen);
      if (!date.value || date.value > date.max || date.value < date.min) { fail(new Error('Choose a visit date in the last 30 days.')); return; }
      // Tidied and checked as the server will (inspectedName in lib/reportTypes.ts).
      const inspected = type?.inspects ? $('start-inspected').value.trim().replace(/\s+/g, ' ') : '';
      if (type?.inspects && !inspected) { fail(new Error(`Say which ${type.inspects.label.toLowerCase()} you are inspecting.`)); $('start-inspected').focus(); return; }
      if (inspected.length > 120) { fail(new Error(`Keep the ${type.inspects.label.toLowerCase()} to 120 characters.`)); return; }
      await chain;
      if (dirty || blocked) { fail(new Error('Export your unsaved changes before starting another report.')); return; }
      const clientKey = uuid();
      // An inspection starts with every check, unanswered, as the server starts one (startingCards).
      const observations = type ? type.checklist.map(c => ({ id: `obs-check-${c.item}`, type: 'check', location: '', whatHappened: '', actionNeeded: '', owner: '', photos: [], check: { item: c.item, question: c.question } })) : [];
      const record = { key: `${principal}::new::${clientKey}`, reportId: `new:${clientKey}`, principalId: principal, seq: uuid(), observations, heldAt: new Date().toISOString(),
        started: { clientKey, projectId: project.id, projectName: project.projectName, projectNumber: project.projectNumber, visitDate: date.value, startedAt: new Date().toISOString(), ...(type ? { reportType: type.id } : {}), ...(inspected ? { inspected } : {}) } };
      try { await put(record); $('start-inspected').value = ''; await show(record); status.textContent = type ? 'Started on this phone. Answer the first check.' : 'Started on this phone. Add your first card.'; } catch (e) { fail(e); }
    };
  }
  // Notes for the next visit as the app last kept them (lib/offlineNotes.ts offlineNotesKey). Read only.
  function notes() {
    let copy = null;
    try { copy = JSON.parse(localStorage.getItem(`relay-offline-notes:${principal}`) || 'null'); } catch {}
    const valid = n => n && typeof n.text === 'string' && typeof n.by === 'string' && typeof n.at === 'string';
    const projects = Array.isArray(copy?.projects) ? copy.projects.filter(p => p && typeof p.projectName === 'string' && typeof p.savedAt === 'string' && Array.isArray(p.open) && p.open.every(valid)) : [];
    if (!projects.length) return;
    const box = $('notes-list');
    const withNotes = projects.filter(p => p.open.length);
    // Opened at /site-notes: that project's notes; otherwise the project last worked on.
    const asked = location.pathname === '/site-notes' ? new URLSearchParams(location.search).get('project') : null;
    let current = null; try { current = localStorage.getItem(`relay-project:${principal}`); } catch {}
    // "Wed 21 Oct, 14:05" in UK time, written out from parts as lib/dates.ts whenShort does (the browser's en-GB says "Wed, 21 Sept").
    const stamp = iso => {
      try {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
        const weekday = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
        const year = +p.year !== new Date().getFullYear() ? ` ${p.year}` : '';
        return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]} ${+p.day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p.month - 1]}${year}, ${p.hour}:${p.minute}`;
      } catch { return ''; }
    };
    const ages = iso => { const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000); return days < 1 ? '' : days === 1 ? ' (a day ago)' : ` (${days} days ago)`; };
    for (const p of withNotes) {
      const item = element('details', '', box, 'nproj');
      item.open = withNotes.length === 1 || p.projectId === (asked || current);
      const summary = element('summary', p.projectName, item);
      element('span', `${p.projectNumber ? `${p.projectNumber} · ` : ''}${plural(p.open.length, 'note')}`, summary, 's');
      // A copy over a week old is likely missing notes, so it says so plainly.
      const old = Date.now() - Date.parse(p.savedAt) > 7 * 86400000;
      element('p', `Last updated ${stamp(p.savedAt)}${ages(p.savedAt)}.${old ? ' This may be out of date.' : ''}`, item, `nsaved${old ? ' old' : ''}`);
      const list = element('ul', '', item, 'nlist');
      for (const n of p.open) {
        const li = element('li', '', list);
        element('p', n.text, li);
        element('p', `${n.by}${n.byTrade ? ` · ${n.byTrade}` : ''} · ${stamp(n.at)}`, li, 'meta');
      }
    }
    if (!withNotes.length) {
      const latest = projects.map(p => p.savedAt).sort().pop();
      element('p', `No open notes on your projects. Last updated ${stamp(latest)}${ages(latest)}.`, box, 'empty');
    }
    $('notes').hidden = false;
    if (asked) $('notes').scrollIntoView({ block: 'start' });
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
  notes();
  startForm();
  list().then(drafts => {
    if (!drafts.length && $('start').hidden) status.textContent = 'Nothing is waiting on this phone. Open RELAY with signal once to start reports from here.';
    const id = /^\/reports\/([^/]+)$/.exec(location.pathname)?.[1];
    const match = drafts.find(d => d.reportId === id && !aside(d)) || drafts.find(d => d.reportId === id);
    if (match) void show(match);
  }).catch(fail);
})();
