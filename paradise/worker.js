// alhena-paradise-worker
//
// Tiny, single-purpose Worker: serves the static ocean-world page at
// paradise.alhena.cc (public/index.html — a sovereign, zero-third-party
// WebGL2 ocean renderer adapted from reference/legacy-roots/pandorachat/
// oasis.html, with the PandoraChat chat/"beings" UI replaced by a simple
// greeting card for James). No API routes, no state, no dependency on
// alhena.cc's main worker.js — deliberately kept separate and minimal.
export default {
  async fetch(request, env, ctx) {
    return env.ASSETS.fetch(request);
  },
};
