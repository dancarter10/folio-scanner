/* Folio text recognition worker.
   Runs Tesseract OCR (tesseract.js-core 5.1.1 build of Tesseract 5, Apache License 2.0) with the
   English "fast" LSTM model from tessdata_fast (Apache License 2.0). Everything runs on the device. */
'use strict';
let mod = null, api = null, booting = null, onProgress = null;
const base = self.location.href.replace(/[^/]*$/, '');

function simd() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch (e) {
    return false;
  }
}

async function boot(report, cfg) {
  if (api) return;
  if (booting) return booting;
  cfg = cfg || {};
  const coreBase = cfg.core || base;
  booting = (async () => {
    report('Loading text engine', 0.05);
    importScripts(coreBase + (simd() ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'));
    const Core = self.TesseractCore;
    if (typeof Core !== 'function') throw new Error('Text engine failed to load');
    mod = await Core({
      TesseractProgress(p) { if (onProgress) onProgress(Math.max(0, (p - 30) / 70)); },
      locateFile: (p) => coreBase + p,
    });
    report('Loading English', 0.45);
    // the language model ships as gzip, or as base64 text where only text files can be hosted
    let data = null;
    const gz = await fetch(cfg.lang || base + 'eng.traineddata.gz').catch(() => null);
    if (gz && gz.ok) data = new Uint8Array(await gz.arrayBuffer());
    else if (!cfg.lang) {
      const txt = await fetch(base + 'eng.traineddata.b64.txt');
      if (!txt.ok) throw new Error('Could not load the English language file (' + txt.status + ')');
      const bin = atob((await txt.text()).replace(/\s+/g, ''));
      data = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    } else throw new Error('Could not download the English language file. Check your connection.');
    if (data[0] === 0x1f && data[1] === 0x8b) {
      const ds = new DecompressionStream('gzip');
      data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());
    }
    mod.FS.writeFile('/eng.traineddata', data);
    data = null;
    api = new mod.TessBaseAPI();
    if (api.Init(null, 'eng', 1) === -1) throw new Error('Text engine could not start');
    api.SetVariable('tessedit_pageseg_mode', '3');
    api.SetVariable('user_defined_dpi', '200');
    report('Ready', 1);
  })();
  try {
    await booting;
  } catch (e) {
    booting = null;
    throw e;
  }
}

function recognize(bytes, w, h) {
  mod.FS.writeFile('/input', bytes);
  if (api.SetImageFile(1, 0) === 1) throw new Error('Could not read the page image');
  api.Recognize(null);
  const words = [], lines = [];
  const ri = api.GetIterator();
  const RIL_TEXTLINE = mod.RIL_TEXTLINE, RIL_WORD = mod.RIL_WORD;
  if (ri && mod.getPointer(ri) !== 0) {
    ri.Begin();
    let line = null;
    do {
      if (ri.Empty(RIL_WORD)) continue;
      if (ri.IsAtBeginningOf(RIL_TEXTLINE)) {
        const b = ri.getBoundingBox(RIL_TEXTLINE);
        line = { x0: b.x0 / w, y0: b.y0 / h, x1: b.x1 / w, y1: b.y1 / h, words: [] };
        lines.push(line);
      }
      if (ri.IsAtBeginningOf(RIL_WORD)) {
        const t = (ri.GetUTF8Text(RIL_WORD) || '').trim();
        if (t) {
          const b = ri.getBoundingBox(RIL_WORD);
          words.push({ t, c: Math.round(ri.Confidence(RIL_WORD)), x0: b.x0 / w, y0: b.y0 / h, x1: b.x1 / w, y1: b.y1 / h });
          if (line) line.words.push(words.length - 1);
        }
      }
    } while (ri.Next(RIL_WORD));
    mod.destroy(ri);
  }
  const text = api.GetUTF8Text() || '';
  const conf = api.MeanTextConf();
  try { mod.FS.unlink('/input'); } catch (e) { /* ignore */ }
  return { text, words, lines, conf };
}

self.onmessage = async (e) => {
  const { id, cmd, bytes, w, h, cfg } = e.data;
  const report = (stage, p) => self.postMessage({ id, progress: p, stage });
  try {
    await boot(report, cfg);
    if (cmd === 'init') { self.postMessage({ id, ok: true, r: { ready: true } }); return; }
    onProgress = (p) => report('Reading text', p);
    const r = recognize(new Uint8Array(bytes), w, h);
    onProgress = null;
    self.postMessage({ id, ok: true, r });
  } catch (err) {
    self.postMessage({ id, ok: false, e: String((err && err.message) || err) });
  }
};
