/* Code on the board: which language a file or a paste is, whether pasted
   text is code at all, and a small highlighter that colours it with the
   kit's code tokens. It knows comments, strings, numbers and keywords for
   the common languages, which is what makes code readable at a glance.  */

export const EXT_LANG: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp", php: "php", dart: "dart", scala: "scala",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash", ps1: "powershell",
  sql: "sql", lua: "lua", r: "r", pl: "perl", hs: "haskell", ex: "elixir", exs: "elixir", clj: "clojure",
  html: "html", htm: "html", xml: "xml", svg: "xml", vue: "vue", svelte: "svelte",
  css: "css", scss: "scss", sass: "scss", less: "css",
  json: "json", jsonc: "json", yml: "yaml", yaml: "yaml", toml: "toml", ini: "ini", env: "ini", conf: "ini",
  md: "markdown", mdx: "markdown", txt: "text", csv: "text", log: "text",
  dockerfile: "dockerfile", makefile: "makefile", gradle: "groovy", graphql: "graphql", gql: "graphql",
  tf: "hcl", prisma: "prisma", proto: "protobuf", zig: "zig", nim: "nim", m: "objective-c", mm: "objective-c",
};

/** the language a file's name says it is, if it's code (or plain text worth reading) */
export function langFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower === "dockerfile" || lower.endsWith(".dockerfile")) return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower.startsWith(".") && !lower.slice(1).includes(".")) return lower === ".env" ? "ini" : "text"; // .gitignore and friends
  const ext = lower.split(".").pop() ?? "";
  return EXT_LANG[ext] ?? null;
}

/** the usual file name ending for a language, to save code back as a file */
export function extFor(lang: string) {
  const hit = Object.entries(EXT_LANG).find(([, l]) => l === lang);
  return hit ? hit[0] : "txt";
}

/** "```ts\n…\n```" → the code and its language */
export function unfence(text: string): { code: string; lang?: string } | null {
  const m = /^\s*```([\w+#.-]*)[^\n]*\n([\s\S]*?)\n?```\s*$/.exec(text);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  return { code: m[2], lang: tag ? (EXT_LANG[tag] ?? tag) : undefined };
}

/** Is this pasted text code? Careful: a sticky is the right home for most writing. */
export function looksLikeCode(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return false;
  const strongStart =
    /^\s*(import\s[\w{*"']|from\s[\w.]+\simport|def\s\w+\(|class\s\w+[\s:({]|function\s*\w*\(|const\s\w+\s*=|let\s\w+\s*=|#include\s|package\s[\w.]+|public\s(static\s)?(class|void|int)|fn\s\w+\(|func\s\w+\(|<\?php|#!\/|SELECT\s|CREATE\s+TABLE|<!DOCTYPE|<html)/im;
  const endings = lines.filter((l) => /[;{}]\s*$|^\s*[})\]],?;?\s*$|=>\s*\{?$|:\s*$/.test(l)).length;
  const indented = lines.filter((l) => /^(\t| {2,})\S/.test(l)).length;
  const symbols = (text.match(/[{}();=<>[\]]/g) ?? []).length / Math.max(1, text.length);
  if (strongStart.test(text) && (endings + indented >= 1 || lines.length >= 3)) return true;
  return lines.length >= 3 && endings / lines.length >= 0.35 && symbols > 0.03;
}

/** a best guess at a pasted snippet's language */
export function guessLang(text: string): string {
  const t = text;
  try {
    if (/^\s*[[{]/.test(t)) {
      JSON.parse(t);
      return "json";
    }
  } catch {}
  if (/^\s*(def |class \w+:|from [\w.]+ import|import \w+$|if __name__)|print\(/m.test(t) && !/[;{]\s*$/m.test(t)) return "python";
  if (/#include\s*[<"]/.test(t)) return /std::|cout|template\s*</.test(t) ? "cpp" : "c";
  if (/\bpackage main\b|\bfunc \w+\(|:= /.test(t)) return "go";
  if (/\bfn \w+\(|let mut |impl\b|println!/.test(t)) return "rust";
  if (/public (static )?(class|void)|System\.out/.test(t)) return "java";
  if (/<\?php/.test(t)) return "php";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/im.test(t)) return "sql";
  if (/^#!\/bin\/(ba|z)?sh|^\s*(echo|cd|npm|npx|git|curl|sudo|brew|apt|pip)\s/m.test(t)) return "bash";
  if (/^\s*<(!DOCTYPE|html|div|span|template|svg|[a-z]+[\s>])/im.test(t)) return "html";
  if (/^\s*[.#@]?[\w-][\w\s.#:>,-]*\{[^}]*:[^}]*;/m.test(t)) return "css";
  if (/:\s*(string|number|boolean)\b|interface \w+|<\w+>\(|: React\./.test(t)) return /<\w[^>]*>/.test(t) && /return\s*\(/.test(t) ? "tsx" : "typescript";
  if (/\b(const|let|function|=>|require\(|module\.exports)\b/.test(t)) return /return\s*\(?\s*</.test(t) ? "jsx" : "javascript";
  if (/^[\w-]+:\s/m.test(t) && !/[{};]/.test(t)) return "yaml";
  return "code";
}

/* ── highlighting ────────────────────────────────────────────────── */
export type Token = { t: "plain" | "keyword" | "string" | "comment" | "number" | "tag"; v: string };

const KEYWORDS = new Set(
  `abstract and as async await break case catch class const continue def default defer del do elif else end enum except export extends
  false final finally fn for foreach from func function go if impl implements import in instanceof interface is lambda let loop match
  mod module mut namespace new nil none not null of or package pass private protected pub public raise readonly return select self
  static struct super switch then this throw throws trait true try type typeof undefined unless until use using var void when where
  while with yield echo fi done local require None True False int string bool float double char long boolean`.split(/\s+/),
);
const SQL = new Set(
  "select from where insert into update delete create table alter drop join left right inner outer on group by order having limit offset as and or not null values set primary key foreign references index distinct union all case when then else end with is in like between".split(
    " ",
  ),
);

type Family = "c" | "hash" | "dash" | "markup" | "css" | "json" | "none";
function family(lang: string): Family {
  if (["python", "ruby", "bash", "yaml", "toml", "ini", "r", "perl", "dockerfile", "makefile", "elixir", "nim", "powershell"].includes(lang)) return "hash";
  if (["sql", "lua", "haskell"].includes(lang)) return "dash";
  if (["html", "xml", "vue", "svelte"].includes(lang)) return "markup";
  if (["css", "scss"].includes(lang)) return "css";
  if (lang === "json") return "json";
  if (["markdown", "text"].includes(lang)) return "none";
  return "c";
}

/** Colour each line. Block comments carry over from one line to the next. */
export function highlight(code: string, lang: string): Token[][] {
  const fam = family(lang);
  const lines = code.split("\n");
  if (fam === "none") return lines.map((l) => [{ t: "plain", v: l }]);
  const line = fam === "hash" ? "#" : fam === "dash" ? "--" : fam === "c" || fam === "css" ? "//" : null;
  const [open, close] = fam === "markup" ? ["<!--", "-->"] : fam === "c" || fam === "css" ? ["/*", "*/"] : [null, null];
  const kw = fam === "dash" && lang === "sql" ? SQL : KEYWORDS;
  let inBlock = false;

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const parts = [
    line ? `${esc(line)}.*$` : null,
    open ? `${esc(open)}` : null,
    `"(?:[^"\\\\]|\\\\.)*"?`,
    fam === "markup" ? null : `'(?:[^'\\\\]|\\\\.)*'?`,
    fam === "c" ? "`(?:[^`\\\\]|\\\\.)*`?" : null,
    fam === "markup" ? "</?[A-Za-z][\\w:.-]*|/?>" : null,
    "\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b|\\b0x[\\da-f]+\\b",
    "\\b[A-Za-z_$][\\w$]*\\b",
  ].filter(Boolean);
  const re = new RegExp(parts.join("|"), "gi");

  return lines.map((text) => {
    const out: Token[] = [];
    let i = 0;
    if (inBlock && close) {
      const end = text.indexOf(close);
      if (end < 0) return [{ t: "comment", v: text }];
      out.push({ t: "comment", v: text.slice(0, end + close.length) });
      i = end + close.length;
      inBlock = false;
    }
    re.lastIndex = i;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > i) out.push({ t: "plain", v: text.slice(i, m.index) });
      const v = m[0];
      if (open && v === open) {
        const end = text.indexOf(close!, m.index + open.length);
        if (end < 0) {
          out.push({ t: "comment", v: text.slice(m.index) });
          inBlock = true;
          i = text.length;
          break;
        }
        out.push({ t: "comment", v: text.slice(m.index, end + close!.length) });
        i = re.lastIndex = end + close!.length;
        continue;
      }
      const t: Token["t"] =
        line && v.startsWith(line)
          ? "comment"
          : v[0] === '"' || v[0] === "'" || v[0] === "`"
            ? fam === "json" && /^\s*:/.test(text.slice(m.index + v.length))
              ? "tag"
              : "string"
            : v[0] === "<" || v[0] === "/" || v === ">"
              ? "tag"
              : /^\d|^0x/i.test(v)
                ? "number"
                : kw.has(lang === "sql" ? v.toLowerCase() : v)
                  ? "keyword"
                  : "plain";
      out.push({ t, v });
      i = m.index + v.length;
      if (v.length === 0) re.lastIndex++;
    }
    if (i < text.length) out.push({ t: "plain", v: text.slice(i) });
    return out;
  });
}

export const TOKEN_CLASS: Record<Token["t"], string> = {
  plain: "",
  keyword: "text-code-keyword",
  string: "text-code-string",
  comment: "text-ink-faint italic",
  number: "text-code-number",
  tag: "text-code-tag",
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
