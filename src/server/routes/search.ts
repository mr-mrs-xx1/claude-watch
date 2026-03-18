import { Router } from 'express';
import { getDb } from '../db.js';
import { scanProjectBrain } from '../../services/brain-scanner.js';

const router = Router();

interface Chunk {
  file: string;
  section: string;
  content: string;
  importance: 'critical' | 'high' | 'normal';
}

interface SearchResult {
  file: string;
  section: string | null;
  lines: string[];
  importance: 'critical' | 'high' | 'normal';
  explanation?: string;
}

// ── Cache: project index built once, reused until TTL ──
interface ProjectIndex {
  chunks: Chunk[];
  compactIndex: string;  // pre-built compact summary for AI prompt
  ts: number;
}

const indexCache: Map<string, ProjectIndex> = new Map();
const CACHE_TTL = 120_000; // 2 minutes

function getIndex(projectPath: string): ProjectIndex {
  const cached = indexCache.get(projectPath);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;

  const scan = scanProjectBrain(projectPath);
  const chunks = buildChunks(scan.files);

  // Pre-build compact index: just section names + first 80 chars + importance
  const compactIndex = chunks.map((c, i) => {
    const imp = c.importance === 'critical' ? ' [!]' : c.importance === 'high' ? ' [*]' : '';
    const preview = c.content.slice(0, 80).replace(/\n/g, ' ');
    return `${i}|${c.file}>${c.section}${imp}|${preview}`;
  }).join('\n');

  const idx: ProjectIndex = { chunks, compactIndex, ts: Date.now() };
  indexCache.set(projectPath, idx);
  return idx;
}

// ── Route ──
router.get('/:projectId', async (req, res) => {
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) return res.json({ results: [], query: q, mode: 'none' });

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; path: string } | undefined;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'ANTHROPIC_API_KEY not set' });

  const index = getIndex(project.path);

  try {
    // Step 1: Pre-filter to top 15 candidates (instant)
    const candidates = preFilter(q, index.chunks, 15);

    // Step 2: Build minimal prompt with only candidates
    const prompt = candidates.map((c, i) => {
      const imp = c.importance === 'critical' ? '!!' : c.importance === 'high' ? '!' : '';
      return `[${i}]${imp} ${c.file}>${c.section}: ${c.content.slice(0, 150).replace(/\n/g, ' ')}`;
    }).join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are searching a project's logic files. "Logic" means: rules, constraints, prompts, behavioral instructions, configuration, strategies, guidelines, safety rules, voice/tone guides, escalation policies, templates, and any content that controls how the system behaves.

These are sections from the project's logic files:
${prompt}

User question: "${q}"

Find the most relevant sections. For questions about "what is this project" or "what does it do", look for overview sections, core behavior, and architecture.

Return JSON array (max 6):
[{"i":<index>,"e":"<1 sentence: why relevant>","l":["<key logical statement from that section>"]}]
"l" must contain actual logic: rules, behaviors, constraints, strategies — from the content. JSON only.`
        }],
      }),
    });

    if (!response.ok) throw new Error(`${response.status}`);

    const data = await response.json() as { content: { type: string; text: string }[] };
    const text = data.content?.[0]?.text || '[]';
    const matches: { i: number; e: string; l?: string[] }[] = JSON.parse(
      text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
    );

    const results: SearchResult[] = matches
      .map(m => {
        const chunk = candidates[m.i];
        if (!chunk) return null;
        return {
          file: chunk.file,
          section: chunk.section,
          lines: m.l?.length ? m.l : chunk.content.split('\n').filter(l => l.trim().length > 10).slice(0, 4),
          importance: chunk.importance,
          explanation: m.e,
        };
      })
      .filter(Boolean) as SearchResult[];

    res.json({ results, query: q, total: results.length, mode: 'ai' });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: String(err) });
  }
});

// ── Chunk builder ──
function buildChunks(files: { relativePath: string; content: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const file of files) {
    const lines = file.content.split('\n');
    let section = file.relativePath;
    let buf: string[] = [];
    const flush = () => {
      const logic = buf.filter(l => {
        const t = l.trim();
        return t.length > 4 && !/^#{1,6}\s/.test(t) && !/^[=\-_*]{3,}$/.test(t)
          && !/^```/.test(t) && !/^\|.*\|$/.test(t) && !/^https?:\/\/\S+$/.test(t);
      }).join('\n').trim();
      if (logic.length > 10) {
        const u = logic.toUpperCase();
        const imp = /\bNEVER\b|\bFORBIDDEN\b|\bCRITICAL\b|\bPRIORITY\s*#?[01]\b/.test(u) ? 'critical' as const
          : /\bALWAYS\b|\bMUST\b|\bREQUIRED\b|\bSAFETY\b/.test(u) ? 'high' as const : 'normal' as const;
        chunks.push({ file: file.relativePath, section, content: logic.slice(0, 800), importance: imp });
      }
      buf = [];
    };
    for (const line of lines) {
      if (line.startsWith('#')) { flush(); section = line.replace(/^#+\s*/, '').trim(); }
      buf.push(line);
    }
    flush();
  }
  return chunks;
}

// ── Pre-filter: fast keyword scoring ──
function preFilter(query: string, chunks: Chunk[], limit: number): Chunk[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  // For broad/meta questions, include overview-type sections
  const isMeta = /what.*(project|this|about|do|purpose|overview)|how.*work|describe|explain|summary/i.test(query);

  return chunks
    .map(c => {
      const text = (c.section + ' ' + c.content).toLowerCase();
      let score = 0;

      // Word matching
      if (words.length) {
        if (text.includes(query.toLowerCase())) score += 10;
        for (const w of words) score += (text.match(new RegExp(w, 'g')) || []).length;
        if (words.some(w => c.section.toLowerCase().includes(w))) score += 5;
      }

      // Importance boost
      if (c.importance === 'critical') score += 3;
      if (c.importance === 'high') score += 1;

      // For meta queries, boost overview/core/role sections
      if (isMeta) {
        const sec = c.section.toLowerCase();
        if (/overview|role|core|identity|purpose|architecture|about|behavior/i.test(sec)) score += 8;
        if (c.section === c.file || /^(CLAUDE|README|SYSTEM)/i.test(c.file)) score += 5;
      }

      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.c);
}

export default router;
