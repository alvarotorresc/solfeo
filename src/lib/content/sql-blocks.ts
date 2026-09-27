/** A fenced ```sql block found in a lesson. */
export interface SqlBlock {
  /** Value of `id=...` for executable blocks, e.g. `q1`. */
  id?: string;
  /** False when the block is marked `no-ejecutar`. */
  executable: boolean;
  /** Value of `motivo="..."`, required for non-executable blocks. */
  reason?: string;
  code: string;
  /** 1-based line of the opening fence, for error messages. */
  line: number;
}

const FENCE = /^(`{3,}|~{3,})\s*(.*)$/;

/** Parses the info string of a fence (` ```sql id=q1 `) into its language and attributes. */
export function parseFenceInfo(info: string): { lang: string; attrs: Map<string, string | true> } {
  const [lang = '', ...rest] = info.trim().split(/\s+/);
  const attrs = new Map<string, string | true>();
  const attrPattern = /([a-z][\w-]*)(?:=(?:"([^"]*)"|(\S+)))?/gi;
  for (const match of rest.join(' ').matchAll(attrPattern)) {
    const [, key = '', quoted, bare] = match;
    attrs.set(key, quoted ?? bare ?? true);
  }
  return { lang: lang.toLowerCase(), attrs };
}

/** Extracts every ```sql block of a Markdown document, in order. */
export function extractSqlBlocks(markdown: string): SqlBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: SqlBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const open = FENCE.exec(lines[index] ?? '');
    if (!open) {
      index += 1;
      continue;
    }
    const [, fence = '', info = ''] = open;
    const start = index;
    const body: string[] = [];
    index += 1;
    while (index < lines.length && !(lines[index] ?? '').trim().startsWith(fence)) {
      body.push(lines[index] ?? '');
      index += 1;
    }
    index += 1;

    const { lang, attrs } = parseFenceInfo(info);
    if (lang !== 'sql') continue;

    const id = attrs.get('id');
    const reason = attrs.get('motivo');
    blocks.push({
      ...(typeof id === 'string' ? { id } : {}),
      executable: !attrs.has('no-ejecutar'),
      ...(typeof reason === 'string' ? { reason } : {}),
      code: body.join('\n').trim(),
      line: start + 1,
    });
  }

  return blocks;
}
