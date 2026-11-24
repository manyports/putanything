/* Pictures bigger than a browser will hold in one canvas.
   A canvas past ~16k pixels a side (or ~16M pixels in all, in Safari) is either
   refused or quietly shrunk, so a big board came out blurry. Instead the picture
   is drawn a tile at a time and the rows are streamed into a PNG as they come. */

/** Within this, one canvas is safe in every browser and the browser's own encoder is used. */
const ONE_CANVAS_PX = 16_000_000;
const ONE_CANVAS_SIDE = 16_384;
/** a tile is at most this a side: 4096² is Safari's whole canvas budget */
const TILE = 4096;
/** rows held at once, as RGBA bytes, so memory stays flat however wide the board is */
const BAND_BYTES = 64 * 1024 * 1024;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, crc = 0xffffffff) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, (crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff) >>> 0);
  return out;
}

/** Draw `img` (already at its final pixel size, w × h) onto `background` and encode it as a PNG. */
export async function drawPng(img: CanvasImageSource, w: number, h: number, background: string): Promise<Blob> {
  if (w * h <= ONE_CANVAS_PX && w <= ONE_CANVAS_SIDE && h <= ONE_CANVAS_SIDE) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
    if (!blob) throw new Error("canvas refused to encode");
    return blob;
  }
  return tiledPng(img, w, h, background);
}

async function tiledPng(img: CanvasImageSource, w: number, h: number, background: string): Promise<Blob> {
  const parts: BlobPart[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, w);
  hv.setUint32(4, h);
  ihdr[8] = 8; // bits per channel
  ihdr[9] = 6; // RGBA
  parts.push(chunk("IHDR", ihdr));

  // the compressed side is read while rows are written, or the stream would stall
  const deflate = new CompressionStream("deflate");
  const writer = deflate.writable.getWriter();
  const reading = (async () => {
    const reader = deflate.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length) parts.push(chunk("IDAT", value));
    }
  })();

  const stride = w * 4;
  const bandH = Math.max(1, Math.min(TILE, Math.floor(BAND_BYTES / stride)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(TILE, w);
  canvas.height = Math.min(bandH, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  let prev = new Uint8Array(stride); // the row above, for the "Up" filter: flat colour compresses to nothing
  let cur = new Uint8Array(stride);

  try {
    for (let y0 = 0; y0 < h; y0 += bandH) {
      const bh = Math.min(bandH, h - y0);
      const tiles: { x0: number; tw: number; px: Uint8ClampedArray }[] = [];
      for (let x0 = 0; x0 < w; x0 += TILE) {
        const tw = Math.min(TILE, w - x0);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, tw, bh);
        ctx.drawImage(img, x0, y0, tw, bh, 0, 0, tw, bh);
        tiles.push({ x0, tw, px: ctx.getImageData(0, 0, tw, bh).data });
      }
      const out = new Uint8Array(bh * (stride + 1));
      for (let r = 0; r < bh; r++) {
        for (const t of tiles) cur.set(t.px.subarray(r * t.tw * 4, (r + 1) * t.tw * 4), t.x0 * 4);
        const o = r * (stride + 1);
        out[o] = 2;
        for (let i = 0; i < stride; i++) out[o + 1 + i] = cur[i] - prev[i];
        [prev, cur] = [cur, prev];
      }
      await writer.write(out);
      // let the page breathe between bands on very large boards
      await new Promise((res) => setTimeout(res, 0));
    }
    await writer.close();
  } catch (e) {
    await writer.abort(e).catch(() => {});
    throw e;
  } finally {
    await reading.catch(() => {});
  }
  parts.push(chunk("IEND", new Uint8Array(0)));
  return new Blob(parts, { type: "image/png" });
}
