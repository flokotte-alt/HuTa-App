// Erzeugt das Huta-Zeichen (ein H unter einem Dach) als SVG und alle App-Symbole als PNG.
// Aufruf im Projektordner: node assets-src/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GREEN = [0x2b, 0x5a, 0x4b];
const CREAM = [0xf4, 0xf3, 0xee];
const WHITE = [255, 255, 255];

// Zeichnung auf einem Raster von 1024: Linien mit runden Enden
const WIDTH = 88;
const LINES = [
  [212, 478, 512, 244], // Dach links
  [512, 244, 812, 478], // Dach rechts
  [322, 392, 322, 772], // linker Pfosten
  [702, 392, 702, 772], // rechter Pfosten
  [322, 616, 702, 616], // Querbalken
];

function distance(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), body.length + 4);
  return out;
}

// scale: Groesse des Zeichens relativ zur Flaeche, background: null = durchsichtig
function png(file, size, { color, background, scale }) {
  const channels = background ? 3 : 4;
  const rows = Buffer.alloc(size * (size * channels + 1));
  const unit = (size / 1024) * scale;
  const center = [512, 508]; // optische Mitte der Zeichnung
  for (let y = 0; y < size; y++) {
    const row = y * (size * channels + 1);
    for (let x = 0; x < size; x++) {
      const gx = (x + 0.5 - size / 2) / unit + center[0];
      const gy = (y + 0.5 - size / 2) / unit + center[1];
      const d = Math.min(...LINES.map((l) => distance(gx, gy, l))) - WIDTH / 2;
      const alpha = Math.max(0, Math.min(1, 0.5 - d * unit));
      const at = row + 1 + x * channels;
      for (let c = 0; c < 3; c++) rows[at + c] = background ? Math.round(background[c] + (color[c] - background[c]) * alpha) : color[c];
      if (!background) rows[at + 3] = Math.round(alpha * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = background ? 2 : 6;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

const root = path.join(__dirname, '..');
const asset = (n) => path.join(root, 'assets', n);

png(asset('icon.png'), 1024, { color: CREAM, background: GREEN, scale: 1 });
png(asset('adaptive-icon.png'), 1024, { color: CREAM, background: null, scale: 0.68 });
png(asset('splash-icon.png'), 512, { color: CREAM, background: null, scale: 1.1 });
png(asset('favicon.png'), 96, { color: CREAM, background: GREEN, scale: 1.15 });
png(asset('notification-icon.png'), 96, { color: WHITE, background: null, scale: 1.3 });

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
fs.writeFileSync(
  path.join(__dirname, 'huta-logo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n  <rect width="1024" height="1024" rx="224" fill="${hex(GREEN)}"/>\n  <g stroke="${hex(CREAM)}" stroke-width="${WIDTH}" stroke-linecap="round" fill="none" transform="translate(0 4)">\n${LINES.map((l) => `    <line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"/>`).join('\n')}\n  </g>\n</svg>\n`,
);
console.log('Symbole erzeugt.');
