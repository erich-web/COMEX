import "server-only";

/**
 * Importação de atas: baixa o arquivo (upload no Storage ou link compartilhado), extrai o texto
 * (PDF via unpdf, Word via mammoth, texto puro) e normaliza as quebras de linha do PDF.
 */

export type Extracted = { text: string; kind: "pdf" | "docx" | "text"; pages?: number };

export async function extractTextFromFile(bytes: Uint8Array, name: string, mime?: string | null): Promise<Extracted> {
  const lower = name.toLowerCase();
  const isPdf = (mime ?? "").includes("pdf") || lower.endsWith(".pdf") || (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
  if (isPdf) {
    const { extractText } = await import("unpdf");
    const r = await extractText(bytes, { mergePages: true });
    return { text: r.text, kind: "pdf", pages: r.totalPages };
  }
  if (lower.endsWith(".docx") || (mime ?? "").includes("officedocument.wordprocessingml") || (bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: r.value, kind: "docx" };
  }
  return { text: new TextDecoder("utf-8").decode(bytes), kind: "text" };
}

const DROP = [/^Ata de Reuni[aã]o RPE\s*RPE_?IMP_?001\s*$/i, /^Elaborado\s*\/\s*revisado por Diretoria de Qualidade\s*$/i, /^RPE_?IMP_?001\s*$/i, /^\d{1,2}$/];
const BULLET = /^([•·▪■\-–]\s+|o\s+(?=[A-ZÀ-Ú0-9])|\d{1,2}[.)]\s+|[a-z][.)]\s+)/;
const HEADING = /^[A-ZÀ-ÚÇ0-9][A-ZÀ-ÚÇ0-9 \-—–/():.,&ºª']{3,}$/;
const LABEL = /^(PAUTA|Reuni[aã]o|Hor[aá]rio|Data|Respons[aá]vel|Nome Cargo|PARTICIPANTES|Atividade Respons[aá]vel Prazo)\b/;
const DSEC = /^D\d\s*[—–-]/;
const END_PUNCT = /[.:;!?)”"]$/;

/** Junta as linhas quebradas pelo PDF e remove o rodapé do modelo — sem apagar conteúdo. */
export function normalizeMinutesText(raw: string): string {
  const src = raw
    .replace(/\r\n/g, "\n")
    .replace(/\\([._*#\-()[\]])/g, "$1")
    .replace(/\*\*/g, "");
  const lines = src
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !DROP.some((p) => p.test(l)));
  const startsNew = (l: string) => BULLET.test(l) || HEADING.test(l) || LABEL.test(l) || DSEC.test(l);
  const isHeading = (l: string) => HEADING.test(l) || LABEL.test(l);
  const out: string[] = [];
  let participants = false;
  for (const l of lines) {
    if (participants) {
      if (startsNew(l) && !/^Nome Cargo/i.test(l)) participants = false;
      else {
        out.push(l);
        continue;
      }
    }
    if (!out.length) {
      out.push(l);
    } else {
      const prev = out[out.length - 1];
      const sn = startsNew(l);
      const prevHeading = isHeading(prev);
      const prevEnds = END_PUNCT.test(prev);
      if (!sn && !prevHeading && !prevEnds) out[out.length - 1] = `${prev} ${l}`;
      else if (!sn && !prevHeading && prevEnds && /^[a-zà-ú]/.test(l)) out[out.length - 1] = `${prev} ${l}`;
      else out.push(l);
    }
    if (/^Nome\s+Cargo\b/i.test(l)) participants = true;
  }
  const final: string[] = [];
  for (const l of out) {
    if (final.length && (HEADING.test(l) || /^PAUTA\b/.test(l) || DSEC.test(l))) final.push("");
    final.push(l);
  }
  return final.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Candidatos de download direto para um link compartilhado (tentados em ordem). */
export function downloadCandidates(url: string): { url: string; kind: "onedrive" | "gdrive" | "other" }[] {
  const u = url.trim();
  if (/^https?:\/\/(1drv\.ms|onedrive\.live\.com|[\w-]+\.sharepoint\.com|[\w-]+-my\.sharepoint\.com)\//i.test(u)) {
    // 1) o próprio link com download=1 (funciona nos links "qualquer pessoa com o link", inclusive os novos 1drv.ms/b/c/…)
    const withDl = u.includes("download=1") ? u : `${u}${u.includes("?") ? "&" : "?"}download=1`;
    // 2) API de shares do OneDrive clássico: "u!" + base64url do link
    const b64 = Buffer.from(u, "utf-8").toString("base64").replace(/\//g, "_").replace(/\+/g, "-").replace(/=+$/, "");
    return [
      { url: withDl, kind: "onedrive" },
      { url: `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`, kind: "onedrive" },
    ];
  }
  const g = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/);
  if (g) return [{ url: `https://drive.google.com/uc?export=download&id=${g[1]}&confirm=t`, kind: "gdrive" }];
  return [{ url: u, kind: "other" }];
}

/** Compat: primeiro candidato. */
export function directDownloadUrl(url: string) {
  return downloadCandidates(url)[0];
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 COMEX-importer";

export async function fetchFromLink(url: string): Promise<{ bytes: Uint8Array; name: string; mime: string | null }> {
  const candidates = downloadCandidates(url);
  let lastError = "";
  for (const d of candidates) {
    try {
      const res = await fetch(d.url, { redirect: "follow", headers: { "user-agent": UA, accept: "application/pdf,application/octet-stream,*/*" } });
      const mime = res.headers.get("content-type");
      if (!res.ok) {
        lastError = `${res.status}`;
        continue;
      }
      if (mime && /text\/html|application\/json/i.test(mime)) {
        lastError = "o link devolveu uma página em vez do arquivo";
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 200) {
        lastError = "arquivo vazio";
        continue;
      }
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const fromUrl = decodeURIComponent(new URL(res.url || d.url).pathname.split("/").pop() ?? "");
      const name = m ? decodeURIComponent(m[1]) : /\.(pdf|docx?|txt)$/i.test(fromUrl) ? fromUrl : (mime ?? "").includes("pdf") ? "ata.pdf" : "ata";
      return { bytes: buf, name, mime };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "falha de rede";
    }
  }
  const kind = candidates[0].kind;
  if (kind === "onedrive") throw new Error(`O OneDrive não entregou o arquivo (${lastError}). O link precisa estar compartilhado como "Qualquer pessoa com o link" — ou envie o PDF pelo botão de upload.`);
  if (kind === "gdrive") throw new Error(`O Google Drive não entregou o arquivo (${lastError}). Arquivos restritos ao grupo não podem ser baixados pelo app — envie o PDF pelo botão de upload.`);
  throw new Error(`Falha ao baixar o arquivo (${lastError}).`);
}
