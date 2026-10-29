import { jsPDF } from 'jspdf';
import logoAp from './assets/logo-ap-asli.png';

/**
 * Mengonversi angka ke teks Terbilang dengan pagar (#... RUPIAH#)
 */
function angkaKeTerbilang(n) {
  const satuan = [
    '', 'SATU', 'DUA', 'TIGA', 'EMPAT', 'LIMA',
    'ENAM', 'TUJUH', 'DELAPAN', 'SEMBILAN', 'SEPULUH', 'SEBELAS'
  ];
  n = Math.floor(Math.abs(n));
  if (n < 12) return satuan[n];
  if (n < 20) return `${angkaKeTerbilang(n - 10)} BELAS`;
  if (n < 100) return `${angkaKeTerbilang(Math.floor(n / 10))} PULUH ${angkaKeTerbilang(n % 10)}`.trim();
  if (n < 200) return `SERATUS ${angkaKeTerbilang(n - 100)}`.trim();
  if (n < 1000) return `${angkaKeTerbilang(Math.floor(n / 100))} RATUS ${angkaKeTerbilang(n % 100)}`.trim();
  if (n < 2000) return `SERIBU ${angkaKeTerbilang(n - 1000)}`.trim();
  if (n < 1000000) return `${angkaKeTerbilang(Math.floor(n / 1000))} RIBU ${angkaKeTerbilang(n % 1000)}`.trim();
  if (n < 1000000000) return `${angkaKeTerbilang(Math.floor(n / 1000000))} JUTA ${angkaKeTerbilang(n % 1000000)}`.trim();
  if (n < 1000000000000) return `${angkaKeTerbilang(Math.floor(n / 1000000000))} MILIAR ${angkaKeTerbilang(n % 1000000000)}`.trim();
  return '';
}

function formatTerbilang(nominal) {
  if (!nominal || nominal <= 0) return '#NOL RUPIAH#';
  return `#${angkaKeTerbilang(nominal).replace(/\s+/g, ' ').trim()} RUPIAH#`;
}

function formatTitik(nominal) {
  return Number(nominal || 0).toLocaleString('id-ID');
}

/**
 * FUNGSI UTAMA CETAK PDF NOTA ARYA PRAMANA
 * Panggil fungsi ini dari aplikasi Anda: generateNotaPDF(dataNota)
 */
export function generateNotaPDF(data) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Konfigurasi Grid 7 Kolom Presisi (Total Lebar = 182mm)
  const marginL = 14;
  const totalW = 182;
  // [No, Tanggal, No.Pol, Nama Barang, Countainer No, Tujuan, Harga]
  const colW = [9, 24, 23, 20, 34, 30, 42];
  const colX = [];
  let currentX = marginL;
  for (const w of colW) {
    colX.push(currentX);
    currentX += w;
  }

  let y = 12;

  // =========================================================================
  // 1. HEADER BOX (LOGO AP + ARYA PRAMANA + BAR HIJAU MUDA)
  // =========================================================================
  const headerH = 31.5;
  doc.setDrawColor(210, 226, 214); // Border hijau abu-abu tipis
  doc.setLineWidth(0.45);
  doc.rect(marginL, y, totalW, headerH);

  // Gambar Logo AP di kiri
  doc.addImage(logoAp, 'PNG', marginL + 3, y + 2, 41, 21.5);

  // Teks Kanan Logo (Font Times menyerupai Cambria)
  const titleX = marginL + 49;
  doc.setFont('times', 'bold');
  doc.setFontSize(22.5);
  doc.setTextColor(0, 0, 0);
  doc.text('ARYA ', titleX, y + 9.5);

  const aryaWidth = doc.getTextWidth('ARYA ');
  doc.setTextColor(23, 100, 165); // Biru PRAMANA
  doc.text('PRAMANA', titleX + aryaWidth, y + 9.5);

  doc.setFont('times', 'bold');
  doc.setFontSize(10.3);
  doc.setTextColor(0, 0, 0);
  doc.text('JASA PENGIRIMAN BARANG DALAM KOTA DAN LUAR KOTA', titleX, y + 15.2);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.3);
  doc.text('Jl. Kedurus Sawah Gede IV/ 10 Surabaya', titleX, y + 20.5);

  // Bar Hijau Mint di bagian bawah dalam kotak header
  doc.setFillColor(184, 223, 200); // #b8dfc8
  doc.rect(marginL + 3.2, y + 25, totalW - 6.4, 3.8, 'F');

  y += headerH + 4.5;

  // =========================================================================
  // 2. KOTAK KEPADA YTH & NOTA NO. (SEJAJAR GRID KOLOM)
  // =========================================================================
  const infoH = 12.2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginL, y, totalW, infoH);

  // Garis vertikal pemisah tengah tepat di batas kanan Kolom 5 (Countainer No.)
  const dividerX = colX[5];
  doc.line(dividerX, y, dividerX, y + infoH);

  // Sisi Kiri (Kepada Yth & Alamat)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kepada Yth,', marginL + 1.5, y + 4.6);
  doc.text('Alamat', marginL + 1.5, y + 10.2);
  doc.text(':', colX[1] + colW[1] - 4.5, y + 10.2);

  // Nilai Kepada Yth & Alamat dimulai tepat di garis Kolom 3 (No. Pol)
  doc.setFont('helvetica', 'normal');
  doc.text(String(data.kepada_yth || ''), colX[2] + 0.5, y + 4.6);
  doc.text(String(data.alamat || ''), colX[2] + 0.5, y + 10.2);

  // Sisi Kanan (Nota No. & Tgl. Nota berada di Kolom 6 / Tujuan)
  doc.setFont('helvetica', 'bold');
  doc.text('Nota No. :', dividerX + 1.5, y + 4.6);
  doc.text('Tgl. Nota :', dividerX + 1.5, y + 10.2);

  // Nilai Nota No & Tgl Nota dimulai tepat di garis Kolom 7 (Harga)
  doc.setFont('helvetica', 'normal');
  doc.text(String(data.nota_no || ''), colX[6] + 0.5, y + 4.6);
  doc.text(String(data.tgl_nota || ''), colX[6] + 0.5, y + 10.2);

  y += infoH + 4.2;

  // =========================================================================
  // 3. HEADER TABEL BIRU (#21598a)
  // =========================================================================
  const headH = 11.5;
  doc.setFillColor(33, 89, 138);
  doc.rect(marginL, y, totalW, headH, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(255, 255, 255);

  const headers = ['No.', 'Tanggal', 'No. Pol', 'Nama\nBarang', 'Countainer No.', 'Tujuan', 'Harga'];
  headers.forEach((text, i) => {
    if (i > 0) doc.line(colX[i], y, colX[i], y + headH);
    const centerX = colX[i] + colW[i] / 2;
    if (text.includes('\n')) {
      const lines = text.split('\n');
      doc.text(lines[0], centerX, y + 4.6, { align: 'center' });
      doc.text(lines[1], centerX, y + 9.2, { align: 'center' });
    } else {
      doc.text(text, centerX, y + 7.0, { align: 'center' });
    }
  });

  y += headH;
  doc.setTextColor(0, 0, 0);

  // =========================================================================
  // 4. ISI BARIS TABEL + 1 BARIS KOSONG PENUTUP
  // =========================================================================
  const rowH = 5.6;
  const rows = [...(data.items || []), { isEmptyRow: true }];

  function drawFitText(text, x, y, maxW, align = 'center', baseFontSize = 9.8) {
    if (text == null || text === '') return;
    const str = String(text);
    doc.setFontSize(baseFontSize);
    const textWidth = doc.getTextWidth(str);

    if (textWidth <= maxW) {
      doc.text(str, x, y, { align });
      return;
    }

    const minFontSize = 6.5;
    const scaled = Math.max(minFontSize, baseFontSize * (maxW / textWidth));
    doc.setFontSize(scaled);

    if (doc.getTextWidth(str) <= maxW) {
      doc.text(str, x, y, { align });
      doc.setFontSize(baseFontSize);
      return;
    }

    let truncated = str;
    while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > maxW) {
      truncated = truncated.slice(0, -1);
    }
    const finalText = truncated ? `${truncated}...` : '';
    if (finalText) {
      doc.text(finalText, x, y, { align });
    }
    doc.setFontSize(baseFontSize);
  }

  rows.forEach((row) => {
    const isMain = !row.isEmptyRow && Boolean((row.no != null && row.no !== '') || row.is_main_row);
    if (isMain) {
      doc.setFillColor(220, 220, 220); // Background abu-abu untuk baris utama ber-nomor
      doc.rect(marginL, y, totalW, rowH, 'FD');
    } else {
      doc.rect(marginL, y, totalW, rowH);
    }

    for (let i = 1; i < 7; i++) {
      doc.line(colX[i], y, colX[i], y + rowH);
    }

    if (!row.isEmptyRow) {
      // Baris utama (ada No) = Bold, Sub-baris (TIMBANG AKR / STAPEL / KULI) = Normal
      doc.setFont('helvetica', isMain ? 'bold' : 'normal');
      doc.setFontSize(9.8);
      const textY = y + 4.1;

      if (row.no != null && row.no !== '') {
        doc.text(String(row.no), colX[0] + colW[0] / 2, textY, { align: 'center' });
      }
      if (row.tanggal) {
        drawFitText(row.tanggal, colX[1] + colW[1] / 2, textY, colW[1] - 2, 'center');
      }
      if (row.no_pol) {
        drawFitText(row.no_pol, colX[2] + colW[2] / 2, textY, colW[2] - 2, 'center');
      }
      if (row.nama_barang) {
        drawFitText(row.nama_barang, colX[3] + colW[3] / 2, textY, colW[3] - 1.5, 'center');
      }
      if (row.container_no) {
        drawFitText(row.container_no, colX[4] + 1.5, textY, colW[4] - 2, 'left');
      }
      if (row.tujuan) {
        drawFitText(row.tujuan, colX[5] + colW[5] / 2, textY, colW[5] - 2, 'center');
      }

      // Kolom Harga: "Rp." rata kiri, Nominal rata kanan
      doc.text('Rp.', colX[6] + 1.5, textY);
      doc.text(formatTitik(row.harga), colX[6] + colW[6] - 1.5, textY, { align: 'right' });
    }

    y += rowH;
  });

  // =========================================================================
  // 5. FOOTER SUMMARY (TERBILANG & JUMLAH / DP CONTAINER / TOTAL TAGIHAN)
  // =========================================================================
  const jumlah = (data.items || []).reduce((sum, r) => sum + Number(r.harga || 0), 0);
  const dp = Number(data.dp_container || 0);
  const totalTagihan = jumlah - dp;

  // Sisi Kiri: Terbilang (Kolom 1 s/d Kolom 4)
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9.8);
  doc.text('Terbilang', marginL + 1, y + 4.1);

  const teksTerbilang = data.terbilang_custom || formatTerbilang(totalTagihan);
  const maxTerbilangW = colW[0] + colW[1] + colW[2] + colW[3] - 4;
  const splitTerbilang = doc.splitTextToSize(teksTerbilang, maxTerbilangW);
  doc.text(splitTerbilang, marginL + 1, y + 9.8);

  // Sisi Kanan: Kotak Abu-abu (Kolom 5+6 untuk Label, Kolom 7 untuk Nominal)
  const sumX = colX[4];
  const sumLabelW = colW[4] + colW[5];
  const sumValX = colX[6];
  const sumValW = colW[6];

  const summaryRows = [
    { label: 'JUMLAH', val: formatTitik(jumlah), bold: false },
    { label: 'DP CONTAINER', val: formatTitik(dp), bold: false },
    { label: 'TOTAL TAGIHAN', val: formatTitik(totalTagihan), bold: true }
  ];

  summaryRows.forEach((s) => {
    doc.setFillColor(199, 199, 199); // #c7c7c7
    doc.rect(sumX, y, sumLabelW, rowH, 'FD');
    doc.rect(sumValX, y, sumValW, rowH, 'FD');

    const textY = y + 4.1;
    doc.setFont('helvetica', s.bold ? 'bolditalic' : 'italic');
    doc.setFontSize(9.8);
    doc.text(s.label, sumX + sumLabelW / 2, textY, { align: 'center' });

    doc.setFont('helvetica', s.bold ? 'bold' : 'normal');
    doc.text('Rp.', sumValX + 1.5, textY);
    doc.text(s.val, sumValX + sumValW - 1.5, textY, { align: 'right' });

    y += rowH;
  });

  // =========================================================================
  // 6. KOTAK INFORMASI BANK (TANPA BORDER, BACKGROUND ABU-ABU #c7c7c7)
  // =========================================================================
  y += 5.6; // Jarak 1 baris kosong
  const bankBoxH = rowH * 3;
  doc.setFillColor(199, 199, 199);
  doc.rect(marginL, y, totalW, bankBoxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);

  const bankRows = [
    { label: 'BANK. :', val: data.bank_name ?? 'BCA' },
    { label: 'A/N. :', val: data.bank_an ?? 'TRIANA DEVI' },
    { label: 'No. REK. :', val: data.bank_rek ?? '429.000.688.6' }
  ];

  bankRows.forEach((b, idx) => {
    const lineY = y + idx * rowH + 4.1;
    doc.text(b.label, marginL + 1.5, lineY);
    // Nilai BCA, TRIANA DEVI, 429.000.688.6 sejajar lurus dengan garis Kolom 3 (No. Pol)
    doc.text(String(b.val), colX[2] + 0.5, lineY);
  });

  const fileName = `Nota_${String(data.nota_no || 'AryaPramana').replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
  return doc;
}
