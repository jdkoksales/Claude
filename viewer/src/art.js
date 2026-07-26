// Procedureel artwork voor de TapKaarten-producten, exact nagemaakt van de
// productfoto's. Alles wordt op canvas getekend.
//
// Uit dezelfde tekenroutine komen twee atlassen (links = voorkant,
// rechts = achterkant):
//   'color' -> de zichtbare print (sRGB)
//   'orm'   -> materiaaldata, glTF-conventie: G = roughness, B = metalness

import { QR } from './qr-data.js';

// Afmetingen van de standaard, van de maatfoto: paneel 7,6 x 12,75 cm,
// voet 5 cm diep.
export const STAND_MM = {
  panelW: 76,
  panelH: 127.5,
  thickness: 3,
  radius: 4,
  baseDepth: 50,
  tiltDeg: 12,
};

// De sticker is een plat vierkant plaatje met plakstrip achterop.
export const STICKER_MM = { w: 100, h: 100, thickness: 2, radius: 8 };

const STAND_PANEL = { w: 760, h: 1275 };
const STICKER_PANEL = { w: 1000, h: 1000 };

// Google-kleuren
const G_BLUE = '#4285f4';
const G_GREEN = '#34a853';
const G_YELLOW = '#fbbc05';
const G_RED = '#ea4335';
const GOLD = '#f2b50f';

const FONT = '"Inter","Helvetica Neue",Helvetica,Arial,sans-serif';
const SCRIPT = 'Georgia,"Times New Roman",serif';
const font = (weight, size, family = FONT) => `${weight} ${size}px ${family}`;
const rm = (r, m) => `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`;

/* ------------------------------------------------------------------ */
/* Basis-helpers                                                       */
/* ------------------------------------------------------------------ */

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function star(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    i === 0
      ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
      : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function centeredText(ctx, text, cx, y) {
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y);
  ctx.textAlign = 'left';
}

function drawQR(ctx, key, x, y, size, color) {
  const qr = QR[key];
  const cell = size / qr.size;
  ctx.fillStyle = color;
  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (qr.bits[row * qr.size + col] === '1') {
        ctx.fillRect(x + col * cell, y + row * cell, cell + 0.5, cell + 0.5);
      }
    }
  }
}

// Hoekhaakjes rond de QR, zoals op de Google-ontwerpen.
function qrBrackets(ctx, x, y, size, color) {
  const g = size * 0.1; // afstand tot de code
  const len = size * 0.16;
  const lw = size * 0.035;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  const corners = [
    [x - g, y - g, 1, 1],
    [x + size + g, y - g, -1, 1],
    [x - g, y + size + g, 1, -1],
    [x + size + g, y + size + g, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Logo's en icoontjes (vereenvoudigde merktekens)                     */
/* ------------------------------------------------------------------ */

// De Google-G: ring in vier kleuren met de blauwe dwarsbalk, opening
// rechtsboven. Canvashoeken: 0 = rechts (3 uur), positief = met de klok mee.
function logoGoogleG(ctx, cx, cy, size, mono) {
  const R = size / 2;
  const lw = R * 0.42;
  const rMid = R - lw / 2;
  const deg = (d) => (d * Math.PI) / 180;
  const seg = (from, to, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rMid, deg(from), deg(to));
    ctx.stroke();
  };
  ctx.save();
  ctx.lineWidth = lw;
  ctx.lineCap = 'butt';
  seg(0, 47, mono || G_BLUE); // rechts, onder de balk
  seg(43, 144, mono || G_GREEN); // onder
  seg(140, 204, mono || G_YELLOW); // linksonder
  seg(200, 320, mono || G_RED); // boven (opening 320-360)
  // Dwarsbalk van het midden naar de rechterrand.
  ctx.fillStyle = mono || G_BLUE;
  ctx.fillRect(cx - lw * 0.1, cy - lw / 2, R + lw * 0.1, lw);
  ctx.restore();
}

// Facebook: witte cirkelrand met een 'f' erin, zoals op de foto.
function logoFacebookRing(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - size * 0.03, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = font(700, size * 0.72, 'Georgia,serif');
  ctx.textAlign = 'center';
  ctx.fillText('f', cx + size * 0.03, cy + size * 0.26);
  ctx.textAlign = 'left';
  ctx.restore();
}

// Instagram: afgeronde vierkante rand, lens en flitser.
function logoInstagram(ctx, cx, cy, size, color) {
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.075;
  ctx.lineJoin = 'round';
  roundRect(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx + s * 0.27, cy - s * 0.27, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Hand met telefoon en NFC-golfjes (het "Tap"-icoon van de foto's).
function iconTapPhone(ctx, cx, cy, size, color) {
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // golfjes links
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.lineWidth = s * 0.055;
    ctx.arc(cx - s * 0.28, cy - s * 0.05, s * 0.1 * i, -0.9, 0.9);
    ctx.stroke();
  }
  // telefoon, licht gekanteld, in een hand
  ctx.translate(cx + s * 0.16, cy);
  ctx.rotate(0.18);
  ctx.lineWidth = s * 0.06;
  roundRect(ctx, -s * 0.16, -s * 0.34, s * 0.32, s * 0.58, s * 0.07);
  ctx.stroke();
  // duim onderaan
  ctx.beginPath();
  ctx.lineWidth = s * 0.09;
  ctx.arc(s * 0.1, s * 0.3, s * 0.14, 0.2, 2.4);
  ctx.stroke();
  ctx.restore();
}

// Hand met telefoon waarop een QR staat (het "Scan"-icoon).
function iconScanPhone(ctx, cx, cy, size, color) {
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(cx, cy);
  ctx.lineWidth = s * 0.06;
  roundRect(ctx, -s * 0.18, -s * 0.36, s * 0.36, s * 0.62, s * 0.07);
  ctx.stroke();
  // mini-QR op het scherm
  const q = s * 0.05;
  for (const [qx, qy] of [[-1.6, -3.2], [0.2, -3.2], [-1.6, -1.4], [0.4, -1.2], [-0.6, -2.3]]) {
    ctx.fillRect(qx * q, qy * q, q * 1.1, q * 1.1);
  }
  // duim
  ctx.beginPath();
  ctx.lineWidth = s * 0.09;
  ctx.arc(s * 0.12, s * 0.32, s * 0.13, 0.2, 2.4);
  ctx.stroke();
  ctx.restore();
}

// Contactloos-symbool van de sticker: ovaal met golfjes en een hand met
// telefoon (label NFC).
function contactlessMark(ctx, cx, cy, w, color) {
  const h = w * 0.62;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // ovaal
  ctx.lineWidth = w * 0.022;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  // golfjes
  for (let i = 0; i <= 3; i++) {
    ctx.beginPath();
    ctx.lineWidth = w * 0.028;
    if (i === 0) {
      ctx.arc(cx - w * 0.18, cy, w * 0.012, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.arc(cx - w * 0.18, cy, w * 0.045 * i, -1.05, 1.05);
      ctx.stroke();
    }
  }
  // telefoon in hand rechts
  const px = cx + w * 0.18;
  ctx.lineWidth = w * 0.02;
  roundRect(ctx, px - w * 0.055, cy - h * 0.34, w * 0.11, h * 0.56, w * 0.02);
  ctx.stroke();
  ctx.font = font(700, w * 0.045);
  ctx.textAlign = 'center';
  ctx.fillText('NFC', px, cy - h * 0.12);
  ctx.textAlign = 'left';
  ctx.beginPath();
  ctx.lineWidth = w * 0.03;
  ctx.arc(px + w * 0.03, cy + h * 0.32, w * 0.05, 0.2, 2.2);
  ctx.stroke();
  ctx.restore();
}

// De rij onderaan de standaards: Tap (icoon) or (icoon) Scan
function tapScanRow(ctx, cx, y, scale, ink) {
  ctx.fillStyle = ink;
  ctx.font = font(650, 40 * scale);
  ctx.textAlign = 'center';
  ctx.fillText('Tap', cx - 250 * scale, y + 14 * scale);
  iconTapPhone(ctx, cx - 130 * scale, y, 95 * scale, ink);
  ctx.font = font(550, 36 * scale);
  ctx.fillText('or', cx, y + 12 * scale);
  iconScanPhone(ctx, cx + 120 * scale, y, 95 * scale, ink);
  ctx.font = font(650, 40 * scale);
  ctx.fillText('Scan', cx + 245 * scale, y + 14 * scale);
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------ */
/* Ontwerpen                                                           */
/* ------------------------------------------------------------------ */

// Google-reviewstandaard (wit of zwart), exact naar de maatfoto:
// titel, G-logo, vijf sterren, QR met hoekhaakjes, Tap/Scan-rij en de
// vierkleurige balk onderaan.
function drawGoogleFront(ctx, ox, mode, dark) {
  const W = STAND_PANEL.w;
  const H = STAND_PANEL.h;
  const cx = ox + W / 2;
  const ink = mode === 'orm' ? rm(0.5, 0) : dark ? '#ffffff' : '#17181c';
  const body = mode === 'orm' ? rm(0.16, 0) : dark ? '#101114' : '#fbfbfc';

  ctx.fillStyle = body;
  ctx.fillRect(ox, 0, W, H);
  if (mode === 'orm') {
    // Alleen de sterren krijgen een metallic goud-accent.
    ctx.fillStyle = rm(0.35, 0.6);
    for (let i = 0; i < 5; i++) star(ctx, cx - 128 + i * 64, H * 0.335, 28, 11.8);
    return;
  }

  ctx.fillStyle = ink;
  ctx.font = font(700, 47);
  centeredText(ctx, "We'd love your feedback", cx, H * 0.12);

  logoGoogleG(ctx, cx, H * 0.235, 150, null);

  ctx.fillStyle = GOLD;
  for (let i = 0; i < 5; i++) star(ctx, cx - 128 + i * 64, H * 0.335, 28, 11.8);

  // QR: donker op wit, licht op zwart — met haakjes eromheen.
  const qrSize = 300;
  const qrX = cx - qrSize / 2;
  const qrY = H * 0.4;
  drawQR(ctx, 'google', qrX, qrY, qrSize, ink);
  qrBrackets(ctx, qrX, qrY, qrSize, ink);

  tapScanRow(ctx, cx, H * 0.755, 0.82, ink);

  // Vierkleurige balk onderaan.
  const barW = W * 0.62;
  const segW = barW / 4;
  const barY = H * 0.815;
  [G_BLUE, G_GREEN, G_YELLOW, G_RED].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx - barW / 2 + i * segW, barY, segW + 0.5, 12);
  });
}

// Facebook-standaard: blauw, cirkel-f, "Follow Us On", woordmerk, witte QR.
function drawFacebookFront(ctx, ox, mode) {
  const W = STAND_PANEL.w;
  const H = STAND_PANEL.h;
  const cx = ox + W / 2;
  const ink = mode === 'orm' ? rm(0.5, 0) : '#ffffff';

  if (mode === 'orm') {
    ctx.fillStyle = rm(0.16, 0);
    ctx.fillRect(ox, 0, W, H);
    return;
  }
  const g = ctx.createLinearGradient(ox, 0, ox, H);
  g.addColorStop(0, '#4a70c8');
  g.addColorStop(1, '#3d5fb2');
  ctx.fillStyle = g;
  ctx.fillRect(ox, 0, W, H);

  logoFacebookRing(ctx, cx, H * 0.155, 175, ink);

  ctx.fillStyle = ink;
  ctx.font = font(600, 44);
  centeredText(ctx, 'Follow Us On', cx, H * 0.275);
  ctx.font = font(800, 88);
  centeredText(ctx, 'facebook', cx, H * 0.355);

  const qrSize = 330;
  drawQR(ctx, 'facebook', cx - qrSize / 2, H * 0.41, qrSize, ink);

  tapScanRow(ctx, cx, H * 0.83, 0.85, ink);
}

// Instagram-standaard: verloop, camera-logo, script-woordmerk, witte QR.
function drawInstagramFront(ctx, ox, mode) {
  const W = STAND_PANEL.w;
  const H = STAND_PANEL.h;
  const cx = ox + W / 2;
  const ink = mode === 'orm' ? rm(0.5, 0) : '#ffffff';

  if (mode === 'orm') {
    ctx.fillStyle = rm(0.16, 0);
    ctx.fillRect(ox, 0, W, H);
    return;
  }
  const g = ctx.createLinearGradient(ox, 0, ox + W, H);
  g.addColorStop(0, '#8a2be2');
  g.addColorStop(0.45, '#d62976');
  g.addColorStop(0.78, '#f2377f');
  g.addColorStop(1, '#fd6b5a');
  ctx.fillStyle = g;
  ctx.fillRect(ox, 0, W, H);

  logoInstagram(ctx, cx, H * 0.15, 165, ink);

  ctx.fillStyle = ink;
  ctx.font = font(600, 44);
  centeredText(ctx, 'Follow Us on', cx, H * 0.265);
  ctx.font = `italic 700 96px ${SCRIPT}`;
  centeredText(ctx, 'Instagram', cx, H * 0.35);

  const qrSize = 330;
  drawQR(ctx, 'instagram', cx - qrSize / 2, H * 0.405, qrSize, ink);

  tapScanRow(ctx, cx, H * 0.83, 0.85, ink);
}

// Achterkant van alle standaards: rustig, met merknaam en NFC-spoel.
function drawStandBack(ctx, ox, mode, variant) {
  const W = STAND_PANEL.w;
  const H = STAND_PANEL.h;
  const cx = ox + W / 2;

  if (mode === 'orm') {
    ctx.fillStyle = rm(0.3, 0);
    ctx.fillRect(ox, 0, W, H);
    return;
  }
  ctx.fillStyle = variant.backColor;
  ctx.fillRect(ox, 0, W, H);

  ctx.save();
  ctx.strokeStyle = variant.backInk;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const inset = 100 + i * 15;
    roundRect(ctx, ox + inset, inset, W - inset * 2, H - inset * 2, 40);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = variant.backInk;
  ctx.font = font(800, 34);
  ctx.textAlign = 'center';
  const text = 'TAPKAARTEN';
  let total = 0;
  ctx.font = font(800, 34);
  const chars = [...text];
  total = chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + 6 * (chars.length - 1);
  let cursor = cx - total / 2;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cursor, H * 0.5);
    cursor += ctx.measureText(c).width + 6;
  }
  ctx.font = font(500, 28);
  centeredText(ctx, 'tapkaarten.nl', cx, H * 0.5 + 48);
}

// Sticker-voorkant: blauwe kop met golf, sterren, tekst, G-badge,
// contactloos-symbool en onderschrift.
function drawStickerFront(ctx, ox, mode) {
  const W = STICKER_PANEL.w;
  const H = STICKER_PANEL.h;
  const cx = ox + W / 2;

  if (mode === 'orm') {
    ctx.fillStyle = rm(0.2, 0);
    ctx.fillRect(ox, 0, W, H);
    return;
  }

  ctx.fillStyle = '#f7f9fb';
  ctx.fillRect(ox, 0, W, H);

  // Blauwe kop met golvende onderrand plus lichtblauw accentlijntje.
  const waveY = H * 0.44;
  const wave = (offset) => {
    ctx.beginPath();
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, waveY + offset);
    ctx.bezierCurveTo(
      ox + W * 0.25, waveY - H * 0.07 + offset,
      ox + W * 0.55, waveY + H * 0.075 + offset,
      ox + W, waveY - H * 0.045 + offset
    );
    ctx.lineTo(ox + W, 0);
    ctx.closePath();
  };
  ctx.fillStyle = '#8ecbe8';
  wave(H * 0.018);
  ctx.fill();
  ctx.fillStyle = '#403cc8';
  wave(0);
  ctx.fill();

  ctx.fillStyle = GOLD;
  for (let i = 0; i < 5; i++) star(ctx, cx - 148 + i * 74, H * 0.115, 30, 12.6);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 58);
  centeredText(ctx, 'WE WOULD APPRECIATE', cx, H * 0.225);
  centeredText(ctx, 'YOUR GOOGLE REVIEW!', cx, H * 0.295);

  // G-badge op de golf.
  const badgeY = waveY - H * 0.015;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, badgeY, 105, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  logoGoogleG(ctx, cx, badgeY, 135, null);

  contactlessMark(ctx, cx, H * 0.665, 420, '#101114');

  ctx.fillStyle = '#101114';
  ctx.font = font(700, 52);
  centeredText(ctx, 'Tap to rate your experience', cx, H * 0.885);
}

// Sticker-achterkant: plakstrip-look, neutraal.
function drawStickerBack(ctx, ox, mode) {
  const W = STICKER_PANEL.w;
  const H = STICKER_PANEL.h;
  if (mode === 'orm') {
    ctx.fillStyle = rm(0.75, 0);
    ctx.fillRect(ox, 0, W, H);
    return;
  }
  ctx.fillStyle = '#f2f1ec';
  ctx.fillRect(ox, 0, W, H);
  // Diagonale tekstjes zoals op plakstrippapier, merkloos gehouden.
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, 0, W, H);
  ctx.clip();
  ctx.translate(ox + W / 2, H / 2);
  ctx.rotate(-0.35);
  ctx.fillStyle = 'rgba(90,120,190,0.35)';
  ctx.font = font(600, 26);
  for (let row = -6; row <= 6; row++) {
    for (let col = -3; col <= 3; col++) {
      ctx.fillText('zelfklevend', col * 300 - 60, row * 110 + (col % 2) * 40);
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Varianten                                                           */
/* ------------------------------------------------------------------ */

export const VARIANTS = {
  'google-wit': {
    label: 'Google Review — wit',
    kind: 'stand',
    swatch: 'linear-gradient(135deg,#ffffff,#e8eaee)',
    rim: '#e9eaee',
    backColor: '#fbfbfc',
    backInk: '#42464e',
    drawFront: (ctx, ox, mode) => drawGoogleFront(ctx, ox, mode, false),
    drawBack: null,
    tapSpot: { u: 0.33, v: 0.245 },
  },
  'google-zwart': {
    label: 'Google Review — zwart',
    kind: 'stand',
    swatch: 'linear-gradient(135deg,#26272c,#0e0f12)',
    rim: '#1a1b1f',
    backColor: '#101114',
    backInk: '#c9ccd2',
    drawFront: (ctx, ox, mode) => drawGoogleFront(ctx, ox, mode, true),
    drawBack: null,
    tapSpot: { u: 0.33, v: 0.245 },
  },
  facebook: {
    label: 'Facebook',
    kind: 'stand',
    swatch: 'linear-gradient(135deg,#4a70c8,#3d5fb2)',
    rim: '#3d5fb2',
    backColor: '#4163b8',
    backInk: '#ffffff',
    drawFront: drawFacebookFront,
    drawBack: null,
    tapSpot: { u: 0.33, v: 0.17 },
  },
  instagram: {
    label: 'Instagram',
    kind: 'stand',
    swatch: 'linear-gradient(135deg,#7b2ff7,#e1306c 55%,#ff6a5f)',
    rim: '#c8367a',
    backColor: '#d24580',
    backInk: '#ffffff',
    drawFront: drawInstagramFront,
    drawBack: null,
    tapSpot: { u: 0.33, v: 0.17 },
  },
  sticker: {
    label: 'Google-sticker',
    kind: 'sticker',
    swatch: 'linear-gradient(180deg,#403cc8 45%,#f7f9fb 45%)',
    rim: '#e8e9ec',
    drawFront: drawStickerFront,
    drawBack: drawStickerBack,
    tapSpot: { u: 0.5, v: 0.335 },
  },
};

export function panelSize(variant) {
  return variant.kind === 'sticker' ? STICKER_PANEL : STAND_PANEL;
}

/* ------------------------------------------------------------------ */
/* Atlas                                                               */
/* ------------------------------------------------------------------ */

// Eén atlas per variant: linkerhelft voorkant, rechterhelft achterkant.
export function buildAtlas(variant, mode) {
  const P = panelSize(variant);
  const canvas = document.createElement('canvas');
  canvas.width = P.w * 2;
  canvas.height = P.h;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  variant.drawFront(ctx, 0, mode);
  if (variant.drawBack) {
    variant.drawBack(ctx, P.w, mode);
  } else {
    drawStandBack(ctx, P.w, mode, variant);
  }
  return canvas;
}

// Eigen ontwerp over één paneel (cover-fit), voor de interactieve viewer.
export function paintCustomArt(canvas, variant, side, image) {
  const P = panelSize(variant);
  const ctx = canvas.getContext('2d');
  const ox = side === 'front' ? 0 : P.w;
  const scale = Math.max(P.w / image.width, P.h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, 0, P.w, P.h);
  ctx.clip();
  ctx.clearRect(ox, 0, P.w, P.h);
  ctx.drawImage(image, ox + (P.w - dw) / 2, (P.h - dh) / 2, dw, dh);
  ctx.restore();
}
