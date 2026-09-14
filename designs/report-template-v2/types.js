/**
 * What a document needs in order to be rendered.
 *
 * Declared here rather than imported from the web app, so the renderer depends
 * on a contract rather than on whatever shape the prototype currently keeps in
 * its store. When rendering moves to the worker — where blueprint 0.3 puts it —
 * nothing about this package changes.
 */
export {};
