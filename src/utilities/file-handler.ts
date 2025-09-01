import fs from 'fs';
import path from 'path';
import multer from 'multer';

export const OUTPUT_DIR = process.env.OUTPUT_DIR ?? './outputs';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
