import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_NAME_TITLE } from '@/lib/constants';

const NAVY = '#1B2B4B';
const GOLD = '#C8A951';
const GREY_LIGHT = '#F1F3F8';

export interface PdfSection {
  title: string;
  kpis?: { label: string; value: string | number }[];
  table?: {
    head: string[];
    body: (string | number)[][];
  };
  text?: string;
}

export interface PdfReport {
  title: string;
  subtitle?: string;
  period?: string;
  sections: PdfSection[];
  filename: string;
}

// Logo oficial Pumangol — recortado ao conteúdo (o PNG tem margem preta à volta).
let logoDataUrlPromise: Promise<{ dataUrl: string; aspect: number } | null> | null = null;

function cropLogo(dataUrl: string): Promise<{ dataUrl: string; aspect: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const src = document.createElement('canvas');
      src.width = img.width;
      src.height = img.height;
      const srcCtx = src.getContext('2d');
      if (!srcCtx) {
        resolve({ dataUrl, aspect: img.width / img.height });
        return;
      }
      srcCtx.drawImage(img, 0, 0);
      const { data, width, height } = srcCtx.getImageData(0, 0, img.width, img.height);
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3];
          if (alpha > 20 && (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20)) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX <= minX || maxY <= minY) {
        resolve({ dataUrl, aspect: img.width / img.height });
        return;
      }
      const sw = maxX - minX + 1;
      const sh = maxY - minY + 1;
      const out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      out.getContext('2d')?.drawImage(src, minX, minY, sw, sh, 0, 0, sw, sh);
      resolve({ dataUrl: out.toDataURL('image/png'), aspect: sw / sh });
    };
    img.onerror = () => resolve({ dataUrl, aspect: 400 / 225 });
    img.src = dataUrl;
  });
}

function getLogoDataUrl(): Promise<{ dataUrl: string; aspect: number } | null> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch('/pumangol-logo-oficial.png')
      .then((res) => res.blob())
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(cropLogo)
      .catch(() => null);
  }
  return logoDataUrlPromise;
}

function drawHeader(doc: jsPDF, title: string, subtitle: string | undefined, period: string | undefined, logo: { dataUrl: string; aspect: number } | null) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logo) {
    try {
      const logoHWanted = 9;
      let logoW = logoHWanted * logo.aspect;
      let logoH = logoHWanted;
      if (logoW > 80) {
        logoW = 80;
        logoH = logoW / logo.aspect;
      }
      doc.addImage(logo.dataUrl, 'PNG', 14, 8, logoW, logoH);
    } catch {
      // imagem indisponível — segue sem logo em vez de falhar a exportação
    }
  }

  // Title
  doc.setTextColor(NAVY);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 30);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 36);
  }

  if (period) {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Período: ${period}`, pageWidth - 14, 30, { align: 'right' });
  }

  // Date
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-AO')} às ${new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`,
    pageWidth - 14,
    36,
    { align: 'right' }
  );

  // Separator
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.5);
  doc.line(14, 42, pageWidth - 14, 42);
}

function drawFooter(doc: jsPDF, pageNumber: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`${APP_NAME_TITLE} · Pumangol E.P.`, 14, pageHeight - 10);
  doc.text(`Página ${pageNumber}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  doc.text('CONFIDENCIAL — Uso interno DPC', pageWidth / 2, pageHeight - 10, { align: 'center' });
}

export async function generatePdfReport(report: PdfReport): Promise<void> {
  const logoDataUrl = await getLogoDataUrl();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 50;

  drawHeader(doc, report.title, report.subtitle, report.period, logoDataUrl);

  for (const section of report.sections) {
    // Check if we need a new page
    if (y > pageHeight - 40) {
      drawFooter(doc, doc.getNumberOfPages());
      doc.addPage();
      drawHeader(doc, report.title, report.subtitle, report.period, logoDataUrl);
      y = 50;
    }

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(NAVY);
    doc.text(section.title, 14, y);
    y += 6;

    // KPIs
    if (section.kpis && section.kpis.length > 0) {
      const kpiWidth = (pageWidth - 28) / section.kpis.length;
      for (let i = 0; i < section.kpis.length; i++) {
        const kpi = section.kpis[i];
        const x = 14 + i * kpiWidth;
        doc.setFillColor(241, 243, 248);
        doc.roundedRect(x, y, kpiWidth - 3, 20, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(kpi.label, x + 4, y + 6);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(NAVY);
        doc.text(String(kpi.value), x + 4, y + 15);
      }
      y += 26;
    }

    // Text
    if (section.text) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(section.text, pageWidth - 28);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 4;
    }

    // Table
    if (section.table) {
      autoTable(doc, {
        head: [section.table.head],
        body: section.table.body,
        startY: y,
        theme: 'striped',
        headStyles: { fillColor: [27, 43, 75], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    y += 4;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i);
  }

  doc.save(report.filename);
}

// === Excel/CSV export ===
export function generateCsvExport(sheets: { name: string; rows: Record<string, string | number>[] }[], filename: string): void {
  // Simple CSV — one section per sheet, separated by blank lines
  const chunks: string[] = [];
  for (const sheet of sheets) {
    chunks.push(`# ${sheet.name}`);
    if (sheet.rows.length === 0) {
      chunks.push('(sem dados)');
      chunks.push('');
      continue;
    }
    const headers = Object.keys(sheet.rows[0]);
    chunks.push(headers.map((h) => `"${h}"`).join(','));
    for (const row of sheet.rows) {
      chunks.push(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
    }
    chunks.push('');
  }
  const blob = new Blob(['﻿' + chunks.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
