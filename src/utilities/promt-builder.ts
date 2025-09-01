export function buildPrompt(args: { originalText: string; type?: string; options?: any }): string {
  const { originalText, type = 'generic', options = {} } = args;
  const tone = options.tone ?? 'professional';
  const makeATS = !!options.makeATS;
  const lines: string[] = [];

  lines.push('You are an expert editor and resume consultant.');
  lines.push(`Task: ${type === 'resume' ? 'Clean, format and make ATS-compliant a resume.' : type === 'letter' ? 'Refine and proofread this letter.' : 'Refine and proofread this document.'}`);
  lines.push('Produce three sections clearly labeled:');
  lines.push('1) CLEANED: — the fully edited text.');
  if (type === 'resume') {
    lines.push('2) ATS_FRIENDLY: — rewrite the resume to be ATS-friendly: plain headers (EXPERIENCE, EDUCATION, SKILLS), bullet points, avoid images/tables, keep factual content—do not invent facts.');
  }
  lines.push('3) CHANGELOG: — short bullet list of edits made.');
  if (makeATS && type !== 'resume') {
    lines.push('Also include ATS_SUGGESTIONS section for adapting this text for ATS.');
  }
  lines.push('If any data appears missing, mark as [MISSING DATA]. Do not add unrelated commentary.');
  lines.push('\nUSER TEXT START\n' + originalText + '\nUSER TEXT END\n');

  return lines.join('\n');
}