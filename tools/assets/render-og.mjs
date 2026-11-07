#!/usr/bin/env node
/* Share image (PORT-PLAN E2). Writes tools/assets/src/og/og-home.png (1200x630): the garden hero room (the native export
   tools/assets/src/customize/garden.png) fills the left 60 %, white paper on the right carries the app icon and the Latin
   wordmark "My Animal Room" in LINE Seed 400. No Korean text, so one image serves every locale. No shadow, frame or glow.
   tools/assets/art/brand.json encodes it to docs/assets/art/og/og-home.<hash>.jpg (q85, 200 KB or less):

     node tools/assets/render-og.mjs && node tools/assets/build-art.mjs --list brand

   Needs the bundled Node and @napi-rs/canvas (NATIVE_NODE_MODULES, see tools/assets/lib/common.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {SRC, ASSETS, NATIVE_NODE_MODULES, sharp, rel} from './lib/common.mjs';

const {createCanvas, loadImage, GlobalFonts} = createRequire(NATIVE_NODE_MODULES + '/')('@napi-rs/canvas');

const W = 1200, H = 630, ART_W = 720;
const INK = '#473E3B';                                   // --ink
const ROOM = path.join(SRC, 'customize/garden.png');     // 780 x 1280; window, chair, flower and plant sit between y 190 and 880
const ICON = path.join(ASSETS, 'icons/app-icon-512.png');
const FONT = path.join(SRC, 'fonts/LINESeedKR-Regular.otf');
const OUT = path.join(SRC, 'og/og-home.png');

GlobalFonts.registerFromPath(FONT, 'LINE Seed');
if (!GlobalFonts.has('LINE Seed')) throw new Error('LINE Seed did not register from ' + rel(FONT));

// Room: cover-fit 780 x 682 (the 720 x 630 aspect) from y 190, resized with sharp's lanczos3.
const roomHeight = Math.round(780 * H / ART_W);
const room = await sharp(ROOM).extract({left: 0, top: 190, width: 780, height: roomHeight}).resize({width: ART_W, height: H, kernel: 'lanczos3'}).png().toBuffer();

const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, W, H);
ctx.drawImage(await loadImage(room), 0, 0, ART_W, H);

// Right paper: icon 96 px, then the wordmark, centred as one group.
const cx = ART_W + (W - ART_W) / 2, iconSize = 96, gap = 28, fontSize = 46;
ctx.font = `400 ${fontSize}px "LINE Seed"`;
ctx.textAlign = 'center';
ctx.textBaseline = 'alphabetic';
const label = 'My Animal Room';
const textWidth = ctx.measureText(label).width;
if (textWidth > (W - ART_W) - 72) throw new Error(`wordmark too wide: ${textWidth}px`);
const capHeight = fontSize * 0.72;
const group = iconSize + gap + capHeight, top = (H - group) / 2;
ctx.imageSmoothingQuality = 'high';
ctx.drawImage(await loadImage(ICON), cx - iconSize / 2, top, iconSize, iconSize);
ctx.fillStyle = INK;
ctx.fillText(label, cx, top + iconSize + gap + capHeight);

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log(`wrote ${rel(OUT)} (${W}x${H}, wordmark ${Math.round(textWidth)} px wide)`);
