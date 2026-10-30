'use strict';
/* Generates the physical kit that closes clinics:
   A5 QR standee · reception desk card · TV caption card.
   Run: npm run assets  →  data/assets/*.pdf */
const fs = require('fs');
const path = require('path');
const PDF = require('pdfkit');
const QR = require('qrcode');
const S = require('../src/store');

const OUT = path.join(__dirname, '..', 'data', 'assets');
const TEAL = '#0B7A6B', AMBER = '#F2A63B', INK = '#0F1E1B', MINT = '#E6F4F1', PAPER = '#FBF8F2', GREY = '#6B7C78';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function standee(org, waNumber) {
  const doc = new PDF({ size: [420, 595], margin: 0 }); // A5 portrait
  const w = 420, h = 595;
  doc.rect(0, 0, w, h).fill(PAPER);
  doc.rect(0, 0, w, 128).fill(TEAL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(30).text('baari', 34, 26);
  doc.fontSize(10).font('Helvetica').fillColor('#CFEDE7').text('Aapki baari, WhatsApp par.', 34, 62);
  doc.fontSize(9).fillColor('#fff').text(org.name, w - 200, 30, { width: 166, align: 'right' });
  doc.fontSize(8).fillColor('#CFEDE7').text(org.area || '', w - 200, 48, { width: 166, align: 'right' });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(25).text('Meri baari', 34, 156, { width: w - 68 });
  doc.text('kab aayegi?', 34, 186, { width: w - 68 });
  doc.fillColor(TEAL).text('Ab Baari bata degi.', 34, 224, { width: w - 68 });
  const link = `https://wa.me/${waNumber}?text=${encodeURIComponent('Hi, mujhe aaj token chahiye')}`;
  const qr = await QR.toDataURL(link, { margin: 1, width: 340, color: { dark: TEAL, light: '#FFFFFF' } });
  doc.image(Buffer.from(qr.split(',')[1], 'base64'), (w - 190) / 2, 272, { width: 190 });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text('Scan karo, baari pao', 0, 476, { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(9.5).fillColor(GREY).text(`WhatsApp: +${waNumber}  ·  ${org.phone || ''}`, 0, 500, { width: w, align: 'center' });
  doc.fontSize(8).text('No app download · No queue me khade raho', 0, 516, { width: w, align: 'center' });
  doc.rect(0, h - 46, w, 46).fill(MINT);
  doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(8.5).text('Powered by baari · front-desk automation', 0, h - 30, { width: w, align: 'center' });
  const f = path.join(OUT, `standee-${org.slug}.pdf`);
  doc.pipe(fs.createWriteStream(f)); doc.end(); await wait(250);
  return f;
}

function deskCard(org) {
  const doc = new PDF({ size: [340, 214], margin: 0 });
  doc.rect(0, 0, 340, 214).fill('#FFFFFF');
  doc.rect(0, 0, 340, 46).fill(TEAL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13).text('BAARI — 4 COMMANDS, BAS', 14, 12);
  doc.fillColor('#CFEDE7').fontSize(7.5).font('Helvetica').text(org.name, 14, 31);
  const rows = [['ADD', 'Naya patient aaya', 'Token khud ban jayega'], ['NEXT', 'Baari aayi', 'Patient ko WhatsApp chala jayega'], ['LATE 15', 'Doctor late', 'Sabko naya samay jayega'], ['EMERGENCY', 'Sabse pehle', 'Sabki line 10 min shift']];
  let y = 60;
  rows.forEach(([cmd, hi, sub], i) => {
    doc.roundedRect(14, y, 92, 28, 6).fill(i === 0 ? AMBER : MINT);
    doc.fillColor(i === 0 ? '#3A2400' : TEAL).font('Helvetica-Bold').fontSize(9.5).text(cmd, 14, y + 9, { width: 92, align: 'center' });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(hi, 116, y + 4);
    doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text(sub, 116, y + 15, { width: 200 });
    y += 34;
  });
  doc.fillColor(GREY).font('Helvetica').fontSize(7).text('Kuch galat? 60 second UNDO. Help ke liye WhatsApp pe "help" likhein.', 14, 196);
  const f = path.join(OUT, `deskcard-${org.slug}.pdf`);
  doc.pipe(fs.createWriteStream(f)); doc.end();
  return f;
}

async function tvCard(org) {
  const doc = new PDF({ size: [420, 297], margin: 0 });
  doc.rect(0, 0, 420, 297).fill(TEAL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(16).text('Yeh TV aapka token board hai', 24, 24, { width: 372 });
  doc.fontSize(10).font('Helvetica').fillColor('#CFEDE7').text('Koi hardware nahi. Koi cable nahi.', 24, 50, { width: 372 });
  const qr = await QR.toDataURL(`http://localhost:3000/tv?t=${org.slug}`, { margin: 1, width: 300, color: { dark: '#FFFFFF', light: '#0B7A6B' } });
  doc.image(Buffer.from(qr.split(',')[1], 'base64'), 24, 84, { width: 130 });
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11).text('TV pe Chrome kholo aur\nyeh link daalo:', 176, 96, { width: 220 });
  doc.font('Courier-Bold').fontSize(10).text(`baari.clinic/tv/${org.slug}`, 176, 142, { width: 220 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#CFEDE7').text('Koi login nahi. Bas link.', 176, 164, { width: 220 });
  const f = path.join(OUT, `tvcard-${org.slug}.pdf`);
  doc.pipe(fs.createWriteStream(f)); doc.end(); await wait(250);
  return f;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('\nBaari print kit\n───────────────');
  for (const org of S.load().orgs) {
    const n = (org.wa?.phone || org.phone || '919999999999').replace(/\D/g, '');
    const wa = n.length >= 11 ? n : '91' + n;
    const a = await standee(org, wa);
    const b = deskCard(org);
    const c = await tvCard(org);
    console.log(`  ${org.slug}: ${path.basename(a)}, ${path.basename(b)}, ${path.basename(c)}`);
  }
  console.log('\ndone →', OUT, '\n');
})();
