import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import axios from 'axios';

import { v4 as uuidv4 } from 'uuid';
import sanitize from 'sanitize-filename';
import { callOpenRouterSystem } from './services/LLM.services';
import { OUTPUT_DIR, upload } from './utilities/file-handler';
import { buildPrompt } from './utilities/promt-builder';
import { safeFilename, generateDocxBuffer, makePdfBuffer, docxBufferToText } from './utilities/utilities';

type CleanRequestBody = {
  text: string;
  type?: 'resume' | 'letter' | 'generic';
  options?: { tone?: string; makeATS?: boolean } | Record<string, unknown>;
};

const app = express();
app.use(express.json({ limit: '2mb' }));

/**
 * POST /clean
 * Body: { text, type?: 'resume'|'letter'|'generic', options?: {} }
 */
app.post('/clean', async (req: Request<{}, {}, CleanRequestBody>, res: Response) => {
  try {
    const { text, type = 'generic', options = {} } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' });

    const prompt = buildPrompt({ originalText: text, type, options });
    const aiResponse = await callOpenRouterSystem(prompt);

    // Parse sections (naive markers)
    const markerClean = 'CLEANED:';
    const markerChangelog = 'CHANGELOG:';
    const markerAts = 'ATS_FRIENDLY:';

    const upper = aiResponse.toUpperCase();
    const idxClean = upper.indexOf(markerClean);
    const idxChangelog = upper.indexOf(markerChangelog);
    const idxAts = upper.indexOf(markerAts);

    let cleaned = aiResponse;
    let changelog: string | null = null;
    let atsFriendly: string | null = null;

    if (idxClean !== -1) {
      if (idxChangelog !== -1) {
        cleaned = aiResponse.substring(idxClean + markerClean.length, idxChangelog).trim();
        changelog = aiResponse.substring(idxChangelog + markerChangelog.length).trim();
        if (idxAts !== -1 && idxAts < idxChangelog) {
          atsFriendly = aiResponse.substring(idxAts + markerAts.length, idxChangelog).trim();
        }
      } else {
        cleaned = aiResponse.substring(idxClean + markerClean.length).trim();
      }
    }

    // files
    const id = uuidv4();
    const baseName = safeFilename((type === 'resume' ? 'resume' : 'document') + '_' + id);
    const docxBuf = await generateDocxBuffer(`${type.toUpperCase()} - Cleaned`, cleaned);
    const docxPath = path.join(OUTPUT_DIR, `${baseName}.docx`);
    fs.writeFileSync(docxPath, docxBuf);
    const pdfBuf = await makePdfBuffer(`${type.toUpperCase()} - Cleaned`, cleaned);
    const pdfPath = path.join(OUTPUT_DIR, `${baseName}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuf);

    res.json({
      ok: true,
      cleaned,
      changelog,
      atsFriendly,
      downloads: { docx: `/download/${path.basename(docxPath)}`, pdf: `/download/${path.basename(pdfPath)}` },
      rawAI: aiResponse
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ ok: false, error: (err as Error).message ?? String(err) });
  }
});

/**
 * POST /upload
 * Form data: file=@file, type=resume|letter|generic, options (json string)
 */
app.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'file is required' });

    const original = file.originalname ?? 'uploaded';
    const ext = path.extname(original).toLowerCase();

    let text: string;
    if (ext === '.docx') {
      text = await docxBufferToText(file.buffer as Buffer);
    } else if (ext === '.txt') {
      text = file.buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Only .docx and .txt allowed.' });
    }

    const type = (req.body.type as string) ?? (original.toLowerCase().includes('resume') ? 'resume' : 'generic');
    const options = req.body.options ? JSON.parse(req.body.options as string) : {};

    const prompt = buildPrompt({ originalText: text, type, options });
    const aiResponse = await callOpenRouterSystem(prompt);

    // parse same as /clean
    const markerClean = 'CLEANED:';
    const markerChangelog = 'CHANGELOG:';
    const markerAts = 'ATS_FRIENDLY:';

    const upper = aiResponse.toUpperCase();
    const idxClean = upper.indexOf(markerClean);
    const idxChangelog = upper.indexOf(markerChangelog);
    const idxAts = upper.indexOf(markerAts);

    let cleaned = aiResponse;
    let changelog: string | null = null;
    let atsFriendly: string | null = null;

    if (idxClean !== -1) {
      if (idxChangelog !== -1) {
        cleaned = aiResponse.substring(idxClean + markerClean.length, idxChangelog).trim();
        changelog = aiResponse.substring(idxChangelog + markerChangelog.length).trim();
        if (idxAts !== -1 && idxAts < idxChangelog) {
          atsFriendly = aiResponse.substring(idxAts + markerAts.length, idxChangelog).trim();
        }
      } else {
        cleaned = aiResponse.substring(idxClean + markerClean.length).trim();
      }
    }

    const id = uuidv4();
    const baseName = safeFilename(path.basename(original, ext) + '_' + id);
    const docxBuf = await generateDocxBuffer(baseName, cleaned);
    const docxPath = path.join(OUTPUT_DIR, `${baseName}.docx`);
    fs.writeFileSync(docxPath, docxBuf);
    const pdfBuf = await makePdfBuffer(baseName, cleaned);
    const pdfPath = path.join(OUTPUT_DIR, `${baseName}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuf);

    res.json({
      ok: true,
      cleaned,
      changelog,
      atsFriendly,
      downloads: { docx: `/download/${path.basename(docxPath)}`, pdf: `/download/${path.basename(pdfPath)}` },
      rawAI: aiResponse
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ ok: false, error: (err as Error).message ?? String(err) });
  }
});

// download route
app.get('/download/:file', (req: Request, res: Response) => {
  try {
    const fileName = sanitize(req.params.file);
    const filePath = path.join(OUTPUT_DIR, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    res.download(filePath);
  } catch (err: unknown) {
    res.status(500).send('Server error');
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`AI letter/resume cleaner (TS) running on http://localhost:${port}`));
