/* No server data or credentials are cached here. All text is rendered as text. */
(() => {
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const editor = document.getElementById('editor');
  let dirty = false;
  let chain = Promise.resolve();
  let selected;
  let blocked = false;
  const urls = [];
  const principal = sessionStorage.getItem('relay-offline-principal');
  const fail = e => {error.textContent = e.message || 'Device storage is unavailable. Keep this page open.';};
  function open(name,store) {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(name);
      request.onupgradeneeded = () => request.transaction.abort();
      request.onerror = () => reject(new Error('No retained data is available in this browser.'));
      request.onsuccess = () => {
        if (!request.result.objectStoreNames.contains(store)) {request.result.close();reject(new Error('No retained drafts are available.'));}
        else resolve(request.result);
      };
    });
  }
  async function allDrafts() {
    const db = await open('relay-drafts','unsent');
    return new Promise((resolve,reject) => {
      const tx = db.transaction('unsent','readonly');
      const request = tx.objectStore('unsent').getAll();
      tx.oncomplete = () => {db.close();resolve(request.result.filter(d => d.principalId === principal));};
      tx.onabort = () => {db.close();reject(tx.error);};
    });
  }
  async function save() {
    if (blocked || !selected) return;
    const current = selected;
    const snapshot = structuredClone(current);
    const editId = Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    const db = await open('relay-drafts','unsent');
    await new Promise((resolve,reject) => {
      const tx = db.transaction('unsent','readwrite');
      const store = tx.objectStore('unsent');
      const request = store.get(snapshot.key);
      request.onsuccess = () => {
        if (!request.result || request.result.seq !== snapshot.seq) {tx.abort();return;}
        snapshot.seq=editId;snapshot.heldAt=new Date().toISOString();
        if (snapshot.report) snapshot.report.observations=snapshot.observations;
        store.put(snapshot);
      };
      tx.oncomplete = () => {db.close();current.seq=editId;resolve();};
      tx.onabort = () => {db.close();reject(new Error('This draft changed in another tab, or device storage failed. Your edits remain on screen. Export a copy before closing.'));};
    });
  }
  function changed() {
    dirty = true;status.textContent='Saving on this phone…';
    chain = chain.then(save).then(() => {
      if (!blocked) status.textContent='Held on this phone only — not submitted';
    }).catch(e => {blocked=true;fail(e);});
    const last = chain;
    last.then(() => {if (chain === last && !blocked) dirty=false;});
  }
  function element(tag,text,parent) {
    const node=document.createElement(tag);if(text) node.textContent=text;if(parent)parent.append(node);return node;
  }
  async function photo(photo,parent) {
    try {
      const db=await open('relay-media','blobs');
      const blob=await new Promise((resolve,reject) => {
        const tx=db.transaction('blobs','readonly');const store=tx.objectStore('blobs');
        let value;const thumb=store.get(`thumb:${photo.id}`);
        thumb.onsuccess=() => {if(thumb.result)value=thumb.result;else {const original=store.get(photo.id);original.onsuccess=()=>{value=original.result;};}};
        tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=()=>{db.close();reject(tx.error);};
      });
      if(blob) {const url=URL.createObjectURL(blob);urls.push(url);const image=element('img','',parent);image.src=url;image.alt=photo.caption || 'Retained photograph';}
    } catch {element('p','Photograph is not available offline on this device.',parent);}
  }
  async function show(draft) {
    await chain;
    if (dirty || blocked) {fail(new Error('Export your unsaved edits before switching drafts.'));return;}
    urls.splice(0).forEach(URL.revokeObjectURL);editor.replaceChildren();selected=structuredClone(draft);
    error.textContent='';
    element('h2',draft.report?.reference || draft.reportId,editor);
    const link=element('a','Open this report when connected',editor);link.href=`/reports/${encodeURIComponent(draft.reportId)}`;
    const download=element('button','Export retained copy',editor);
    download.onclick=()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='relay-retained-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    if (!Number.isInteger(draft.baseVersion)) element('p','This older retained draft has no save version. Export it for comparison; Relay will not silently overwrite the server copy.',editor);
    for(const observation of selected.observations) {
      const section=element('section','',editor);element('h3',observation.location || 'Update',section);
      for(const [key,title] of [['location','Location'],['whatHappened','What happened'],['actionNeeded','Action needed'],['owner','Owner']]) {
        const label=element('label',title,section);const field=element(key==='whatHappened'||key==='actionNeeded'?'textarea':'input','',label);
        field.value=observation[key];field.oninput=()=>{observation[key]=field.value;changed();};
      }
      for(const p of observation.photos) void photo(p,section);
    }
    status.textContent='Held on this phone only — not submitted';
  }
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  if(!principal) {status.textContent='Reconnect and sign in to recover your drafts. No offline identity is retained for this tab.';return;}
  allDrafts().then(drafts=>{
    status.textContent=drafts.length ? 'Select a retained draft.' : 'No unsent drafts are retained for this person in this browser.';
    for(const draft of drafts) {const button=element('button',draft.report?.reference || draft.reportId,document.getElementById('drafts'));button.onclick=async()=>{const fresh=(await allDrafts()).find(d=>d.key===draft.key);if(fresh) await show(fresh);};}
    const id=/^\/reports\/([^/]+)$/.exec(location.pathname)?.[1];
    const match=drafts.find(d=>d.reportId===id);if(match) void show(match);
  }).catch(fail);
})();
