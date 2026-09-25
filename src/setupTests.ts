import '@testing-library/jest-dom';

// happy-dom has no IndexedDB. Modules that open a DB at import time (e.g.
// web2-document.service's singleton) otherwise throw "indexedDB is not
// defined" as an unhandled rejection, which fails the whole run for any test
// that transitively imports them. No test exercises IndexedDB, so a no-op
// stub whose request never resolves is enough — it just prevents the crash.
if (typeof globalThis.indexedDB === 'undefined') {
  const noopRequest = (): IDBOpenDBRequest =>
    ({
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      onblocked: null,
      result: null,
    }) as unknown as IDBOpenDBRequest;
  globalThis.indexedDB = {
    open: noopRequest,
    deleteDatabase: noopRequest,
    databases: async () => [],
    cmp: () => 0,
  } as unknown as IDBFactory;
}
