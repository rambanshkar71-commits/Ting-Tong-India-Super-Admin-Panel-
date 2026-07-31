import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

/**
 * Export array of objects to Excel file (.xlsx)
 */
export function exportToExcel(data: any[], fileName: string, sheetName: string = 'Data') {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (err) {
    console.error('Failed to export Excel:', err);
    alert('Export to Excel failed. Please check browser permissions.');
  }
}

/**
 * Export tabular data to PDF document
 */
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string
) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(249, 115, 22); // orange-500
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TING TONG INDIA - ENTERPRISE REPORT', 14, 15);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), 14, 23);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 140, 23);

    // Table positioning
    let startY = 38;
    const pageWidth = 180;
    const colWidth = pageWidth / Math.max(headers.length, 1);

    // Table Header Row
    doc.setFillColor(241, 245, 249);
    doc.rect(14, startY, pageWidth, 8, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    headers.forEach((header, index) => {
      const x = 14 + index * colWidth + 2;
      doc.text(String(header), x, startY + 5);
    });

    startY += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    rows.forEach((row) => {
      if (startY > 270) {
        doc.addPage();
        startY = 20;
      }
      row.forEach((cell, index) => {
        const x = 14 + index * colWidth + 2;
        const text = String(cell ?? '');
        doc.text(text.length > 25 ? text.substring(0, 22) + '...' : text, x, startY + 4);
      });
      startY += 7;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, startY, 14 + pageWidth, startY);
    });

    doc.save(`${fileName}.pdf`);
  } catch (err) {
    console.error('Failed to export PDF:', err);
    alert('Export to PDF failed.');
  }
}

/**
 * Print a custom HTML report
 */
export function printReport(title: string, contentHtml: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return alert('Popups blocked. Please allow popups to print report.');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #0f172a; }
          h1 { color: #ea580c; margin-bottom: 4px; font-size: 20px; }
          .subtitle { color: #64748b; font-size: 12px; margin-bottom: 20px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; font-family: monospace; }
          .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .badge-success { background: #dcfce7; color: #166534; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-danger { background: #fee2e2; color: #991b1b; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>TING TONG INDIA - ${title.toUpperCase()}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()} | Master Admin Verification Audit</div>
        ${contentHtml}
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
