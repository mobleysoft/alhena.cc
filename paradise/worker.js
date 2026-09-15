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
    const url = new URL(request.url);
    if (url.pathname === "/api/paradise-godot/index.wasm") {
      const chunkPaths = [
        "/game-v3/godot/index.wasm.part00",
        "/game-v3/godot/index.wasm.part01",
      ];
      const chunks = await Promise.all(chunkPaths.map(async (pathname) => {
        const chunkUrl = new URL(request.url);
        chunkUrl.pathname = pathname;
        const response = await env.ASSETS.fetch(new Request(chunkUrl, request));
        if (!response.ok) throw new Error(`Missing Godot WASM chunk ${pathname}`);
        return response.arrayBuffer();
      }));
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const wasm = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        wasm.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      return new Response(wasm, {
        headers: {
          "Content-Type": "application/wasm",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Cross-Origin-Opener-Policy": "same-origin",
        },
      });
    }
    if (url.pathname === "/api/paradise-godot/index.audio.worklet.js" ||
        url.pathname === "/api/paradise-godot/index.audio.position.worklet.js") {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = url.pathname.replace("/api/paradise-godot/", "/game-v3/godot/");
      const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (assetResponse.ok) {
        const headers = new Headers(assetResponse.headers);
        headers.set("Content-Type", "text/javascript; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(assetResponse.body, {
          status: assetResponse.status,
          statusText: assetResponse.statusText,
          headers,
        });
      }
    }
    if (url.pathname === "/game-v3/godot/index.wasm") {
      const encodedUrl = new URL(request.url);
      encodedUrl.pathname = "/game-v3/godot/index.wasm.br";
      const assetResponse = await env.ASSETS.fetch(new Request(encodedUrl, request));
      if (assetResponse.ok) {
        const headers = new Headers(assetResponse.headers);
        headers.set("Content-Type", "application/wasm");
        headers.set("Content-Encoding", "br");
        headers.set("Vary", "Accept-Encoding");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(assetResponse.body, {
          status: assetResponse.status,
          statusText: assetResponse.statusText,
          headers,
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
