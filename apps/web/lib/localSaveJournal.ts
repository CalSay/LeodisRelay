import type { SaveJournal, SaveRequest } from './saveRequest';
import { advanceBase } from './localDraft';
import { tabId } from './tabId';

/**
 * One journal per tab. Two tabs on one draft used to share it, so the second
 * tab replayed the first tab's request and then saved its own edits on top of
 * the version that produced, overwriting the first tab's work without a word.
 */
export function localSaveJournal(reportId:string,principalId:string):SaveJournal {
  const tab = tabId();
  const key = `${principalId}::${reportId}::${tab}`;
  async function transaction<T>(work:(store:IDBObjectStore,result:(value:T)=>void)=>void):Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open('relay-save-requests',1);
      request.onupgradeneeded = () => request.result.createObjectStore('requests');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Device storage is blocked.'));
    });
    return new Promise<T>((resolve,reject) => {
      const tx = db.transaction('requests','readwrite');
      let result:T;
      work(tx.objectStore('requests'),value => {result=value;});
      tx.oncomplete = () => {db.close();resolve(result);};
      tx.onabort = () => {db.close();reject(tx.error ?? new Error('Device storage failed.'));};
    });
  }
  return {
    claim: input => transaction<SaveRequest>((store,result) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const existing = request.result as SaveRequest | undefined;
        if (!existing) store.put(input,key);
        result(existing ?? input);
      };
    }),
    acknowledge: async (id,version) => {
      await advanceBase(reportId,principalId,version,tab);
      await transaction<void>((store,result) => {
        const request = store.get(key);
        request.onsuccess = () => { if (request.result?.requestId === id) store.delete(key); result(); };
      });
    },
    discard: id => transaction<void>((store,result) => {
      const request = store.get(key);
      request.onsuccess = () => { if (request.result?.requestId === id) store.delete(key); result(); };
    }),
  };
}
