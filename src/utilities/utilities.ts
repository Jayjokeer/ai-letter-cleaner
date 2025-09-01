import mammoth from "mammoth";
import sanitize from "sanitize-filename";
import { v4 as uuidv4 } from 'uuid';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';


export function safeFilename(name: string) {
  return sanitize(name).replace(/\s+/g, '_').slice(0, 120);
}

export async function docxBufferToText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function generateDocxBuffer(title: string, text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 28 })],
        }),
        ...text.split('\n').map(line => new Paragraph(line))
      ],
    }],
  });
  return await Packer.toBuffer(doc);
}

export function makePdfBuffer(title: string, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    doc.fontSize(20).text(title, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(text);
    doc.end();
  });
}
