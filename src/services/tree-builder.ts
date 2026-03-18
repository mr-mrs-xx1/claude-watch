export interface TreeNode {
  id: string;
  label: string;
  type: 'root' | 'file' | 'section' | 'rule' | 'item';
  children: TreeNode[];
  content?: string;
  source?: string;
  importance?: 'critical' | 'high' | 'normal';
  icon?: string;
}

// Sections that are structural, not logic
const STRUCTURAL_SECTIONS = /^(table of contents|toc|sources|references|version history|changelog entries|license|credits|acknowledgements?|appendix|index|prerequisites|installation|setup|getting started|dependencies|requirements|imports?|directory structure|file structure|project structure|folder structure)$/i;

// Section names that are always structural noise
function isStructuralSection(label: string): boolean {
  if (STRUCTURAL_SECTIONS.test(label.trim())) return true;
  if (/^[=\-_\s*]{5,}$/.test(label.trim())) return true;
  return false;
}

// Items that are noise, not logic
function isNoiseItem(text: string): boolean {
  const t = text.trim();
  if (t.length < 5) return true;
  if (/^https?:\/\/\S+$/.test(t)) return true;                  // bare URLs
  if (/^~?\/[\w/.@-]+\s*[-–—]\s*\w/.test(t) && t.length < 80) return false; // dir + description is OK
  if (/^~?\/[\w/.@-]+\s*$/.test(t)) return true;                // bare file paths
  if (/^\|.*\|$/.test(t)) return true;                           // table rows
  if (/^[=\-_*]{3,}$/.test(t)) return true;                     // separators
  if (/^```/.test(t)) return true;                               // code fences
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;               // bare dates
  if (/^v?\d+\.\d+(\.\d+)?$/.test(t)) return true;              // bare version numbers
  return false;
}

function countItems(node: TreeNode): number {
  if (node.type === 'item' || node.type === 'rule') return 1;
  return node.children.reduce((s, c) => s + countItems(c), 0);
}

// Does a section contain any actual logic (rules, instructions, constraints)?
function hasLogicContent(node: TreeNode): boolean {
  if (node.importance === 'critical' || node.importance === 'high') return true;
  if (node.children.some(c => c.importance === 'critical' || c.importance === 'high')) return true;
  // At least some non-trivial items
  const meaningful = node.children.filter(c => !isNoiseItem(c.label));
  return meaningful.length > 0;
}

export function buildLogicTree(
  files: { relativePath: string; name: string; content: string; category: string }[],
  projectName: string,
): TreeNode {
  const root: TreeNode = {
    id: 'root',
    label: projectName,
    type: 'root',
    icon: '🧠',
    children: [],
  };

  for (const file of files) {
    const fileNode = parseFileToTree(file);
    // Only include files that have meaningful logic content (at least 3 items)
    const itemCount = countItems(fileNode);
    if (fileNode.children.length > 0 && itemCount >= 5) {
      root.children.push(fileNode);
    }
  }

  return root;
}

function parseFileToTree(file: { relativePath: string; name: string; content: string; category: string }): TreeNode {
  const icon = getFileIcon(file.category, file.name);
  const label = getHumanLabel(file.relativePath, file.content);

  const fileNode: TreeNode = {
    id: file.relativePath,
    label,
    type: 'file',
    icon,
    source: file.relativePath,
    children: [],
  };

  const lines = file.content.split('\n');
  let i = 0;
  let currentH1: TreeNode | null = null;
  let currentH2: TreeNode | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // Skip code blocks
    if (line.startsWith('```')) {
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) i++;
      i++;
      continue;
    }

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      const title = line.slice(2).trim();
      if (!isStructuralSection(title)) {
        currentH1 = makeSection(title, file.relativePath, 'h1');
        currentH2 = null;
        fileNode.children.push(currentH1);
      }
      i++; continue;
    }

    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      if (!isStructuralSection(title)) {
        const section = makeSection(title, file.relativePath, 'h2');
        currentH2 = section;
        (currentH1 || fileNode).children.push(section);
      } else {
        currentH2 = null; // skip this section's items too
      }
      i++; continue;
    }

    if (line.startsWith('### ')) {
      const title = line.slice(4).trim();
      if (!isStructuralSection(title)) {
        const section = makeSection(title, file.relativePath, 'h3');
        const parent = currentH2 || currentH1 || fileNode;
        parent.children.push(section);
        i++;
        while (i < lines.length && !lines[i].startsWith('#')) {
          const item = tryParseItem(lines[i], file.relativePath);
          if (item) section.children.push(item);
          i++;
        }
      } else {
        // Skip items under structural h3
        i++;
        while (i < lines.length && !lines[i].startsWith('#')) i++;
      }
      continue;
    }

    const item = tryParseItem(line, file.relativePath);
    if (item) {
      const parent = currentH2 || currentH1 || fileNode;
      parent.children.push(item);
    }

    i++;
  }

  // Flatten single top-level section
  if (fileNode.children.length === 1 && fileNode.children[0].type === 'section') {
    const child = fileNode.children[0];
    fileNode.children = child.children;
  }

  // Remove structural sections, empty sections, sections with no logic
  fileNode.children = filterTree(fileNode.children);

  return fileNode;
}

function filterTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.filter(node => {
    // Remove garbage labels
    if (/^[=\-_\s*]{5,}$/.test(node.label.trim())) return false;
    // Remove structural sections
    if (node.type === 'section' && isStructuralSection(node.label)) return false;

    // Recursively filter children
    if (node.children.length > 0) {
      node.children = filterTree(node.children);
    }

    // Keep if it has logic content
    if (node.type === 'section') return hasLogicContent(node);
    if (node.type === 'item' || node.type === 'rule') return !isNoiseItem(node.label);
    return node.children.length > 0;
  });
}

function makeSection(title: string, source: string, level: string): TreeNode {
  return {
    id: `${source}:${level}:${title}`,
    label: title,
    type: 'section',
    source,
    importance: getImportance(title),
    children: [],
  };
}

function tryParseItem(line: string, source: string): TreeNode | null {
  const trimmed = line.trim();
  if (!trimmed || isNoiseItem(trimmed)) return null;

  const listMatch = trimmed.match(/^[-*]\s+(.+)$/) || trimmed.match(/^\d+[.)]\s+(.+)$/);
  if (listMatch) {
    const text = listMatch[1];
    if (isNoiseItem(text)) return null;
    return {
      id: `${source}:item:${text.slice(0, 50)}`,
      label: text,
      type: 'item',
      importance: getImportance(text),
      children: [],
      source,
    };
  }

  // Key-value rules
  if (trimmed.includes(':') && trimmed.length < 200 && !trimmed.startsWith('http')) {
    const importance = getImportance(trimmed);
    if (importance !== 'normal' || trimmed.length < 100) {
      return {
        id: `${source}:rule:${trimmed.slice(0, 50)}`,
        label: trimmed,
        type: 'rule',
        importance,
        children: [],
        source,
      };
    }
  }

  return null;
}

function getImportance(text: string): 'critical' | 'high' | 'normal' {
  const upper = text.toUpperCase();
  if (/\bNEVER\b|\bPRIORITY\s*#?[01]\b|\bFORBIDDEN\b|\bCRITICAL\b/.test(upper)) return 'critical';
  if (/\bALWAYS\b|\bMUST\b|\bREQUIRED\b|\bENFORCED\b|\bSAFETY\b/.test(upper)) return 'high';
  return 'normal';
}

function getFileIcon(category: string, name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('prompt') || lower.includes('system')) return '🎯';
  if (lower.includes('voice') || lower.includes('writing') || lower.includes('style')) return '🗣️';
  if (lower.includes('playbook') || lower.includes('strategy')) return '📋';
  if (lower.includes('learning') || lower.includes('insight')) return '💡';
  if (lower.includes('skill')) return '🎓';
  if (lower.includes('changelog') || lower.includes('history')) return '📜';
  if (lower.includes('growth') || lower.includes('plan') || lower.includes('roadmap')) return '📈';
  if (lower.includes('performance') || lower.includes('metric')) return '📊';
  if (lower.includes('calendar') || lower.includes('schedule')) return '📅';
  if (lower.includes('template')) return '📝';
  if (lower.includes('config') || lower.includes('setting')) return '⚙️';
  if (lower.includes('infra') || lower.includes('architecture')) return '🏗️';
  if (lower.includes('enhancement') || lower.includes('todo')) return '🚀';
  if (lower.includes('influencer') || lower.includes('research')) return '🔍';
  if (category === 'rules') return '📏';
  if (category === 'prompt') return '🎯';
  if (category === 'config') return '⚙️';
  if (category === 'docs') return '📄';
  if (category === 'state') return '📊';
  return '📄';
}

function getHumanLabel(relativePath: string, content: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1];
  const name = relativePath.split('/').pop() || relativePath;
  return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());
}
