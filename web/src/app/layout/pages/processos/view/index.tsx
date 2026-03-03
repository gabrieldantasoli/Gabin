import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, FileText, CircleCheck, CircleX, Clock, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./index.module.css";

type MetadadoRow = { id: number; nome: string; valor: string | null };

type EventoRow = {
  id: number;
  nome: string;
  created_at: string;
  status_nome: string | null;

  procurador_id: number | null;
  procurador_nome: string | null;

  evento_pages_json: string | null;
  evento_conteudo_paginas?: string | null;
};

const FIELD_KEYWORDS: Record<string, string[]> = {
  teve_citacao: [
    "## CITAÇÃO",
    "CITAÇÃO",
    "NOTIFICAÇÃO/CITAÇÃO",
    "## NOTIFICAÇÃO",
    "NOTIFICAÇÃO",
    "CITAR o Senhor",
    "CITE-SE",
    "foi citado",
    "foi devidamente citado",
    "citado para apresentar defesa",
    "mandado de citação",
  ],
  teve_publicacao: [
    "## CERTIDÃO DE PUBLICAÇÃO",
    "CERTIDÃO DE PUBLICAÇÃO",
    "CERTIDÃO",
    "## CERTIDÃO",
    "foi publicada a Citação",
    "foi publicada a citação",
    "publicada no Diário Eletrônico",
    "publicada no Diário de Contas",
    "publicou-se",
    "publicado",
    "publicada",
    "PUBLICAÇÃO",
  ],
  teve_dilacao_prazos: [
    "## DESPACHO",
    "DESPACHO",
    "dilação de prazo",
    "pedido de dilação",
    "prorrogação de prazo",
    "prorrogar o prazo",
    "prorrogado o prazo",
    "prorrogação do prazo",
    "deferido o pedido de dilação",
    "indeferido o pedido de dilação",
    "prorrogação do prazo para apresentação da defesa",
  ],
  teve_defesa: [
    "## DEFESA",
    "apresentar defesa",
    "apresentou defesa",
    "apresentação da defesa",
    "DEFESA",
    "contrarrazões",
    "contrarrazões recursais",
    "não apresentou defesa",
    "defesa complementar",
  ],
  relatorio_preliminar_conclusivo: [
    "## RELATÓRIO PRELIMINAR DE ANÁLISE TÉCNICA",
    "RELATÓRIO DE ANÁLISE TÉCNICA PRELIMNAR",
    "RELATÓRIO DE PRELIMINAR DE ANÁLISE TÉCNICA",
    "Relatório de Análise Técnica Preliminar",
    "RELATÓRIO DE ANALISE TÉCNICA",
    "relatório preliminar de análise técnica",
    "relatório preliminar",
    "relatório de análise técnica preliminar",
    "RELATÓRIO DE ANÁLISE TÉCNICA",
    "conclusão",
    "opina",
    "opinou pela irregularidade",
    "opina pela aprovação",
    "propõe",
  ],
  teve_proposta_encaminhamentos: [
    "## PROPOSTA DE ENCAMINHAMENTO",
    "PROPOSTA DE ENCAMINHAMENTO",
    "Proposta de encaminhamento",
    "Proposta de Encaminhamento",
    "submetem-se os autos à consideração superior, propondo",
    "propomos",
    "propõe",
    "ante o exposto, submetem-se os autos",
    "ante o exposto, submetemos os autos",
  ],
  teve_analise_conclusiva_complementar: [
    "RELATÓRIO DE ANÁLISE TÉCNICA COMPLEMENTAR",
    "Relatório de Análise Técnica Complementar",
    "RELATÓRIO DE ANÁLISE TÉCNICA CONCLUSIVO",
    "RELATÓRIO CONCLUSIVO DE ANÁLISE TÉCNICA",
    "Relatório de Análise Técnica Conclusivo",
    "Relatório Conclusivo de Análise Técnica",
    "RELATÓRIO COMPLEMENTAR DE ANÁLISE TÉCNICA",
    "Relatório Complementar de Análise Técnica",
    "RELATÓRIO DE ANÁLISE TÉCNICA",
    "RELATÓRIO TÉCNICO COMPLEMENTAR",
    "Relatório Técnico Complementar",
    "RELATÓRIO TÉCNICO CONCLUSIVO",
    "Relatório Técnico Conclusivo",
    "RELATÓRIO CONCLUSIVO",
  ],
  pronunciamento_MP: [
    "MINISTÉRIO PÚBLICO DE CONTAS",
    "Ministério Público de Contas junto ao Tribunal de Contas",
    "MINISTÉRIO PÚBLICO JUNTO AO TRIBUNAL DE CONTAS",
    "MPC",
    "Ministério Público de Contas",
  ],
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function normalizeStatus(s: string | null) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function statusLabel(s: string | null) {
  const v = normalizeStatus(s);
  if (v === "processado") return "Processado";
  if (v === "processando") return "Processando";
  if (v === "aguardando_processamento") return "Aguardando";
  return s || "—";
}

function parsePagesLike(v: string | null): number[] {
  if (!v) return [];
  const s = String(v).trim();
  if (!s) return [];

  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
      }
    } catch {}
  }

  return s
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseConteudoPaginasJson(raw: string | null | undefined): Record<number, string> {
  if (!raw) return {};
  let s = String(raw).trim();
  if (!s) return {};

  const toRecord = (obj: any): Record<number, string> => {
    const out: Record<number, string> = {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;

    for (const [k, v] of Object.entries(obj)) {
      const page = Number(k);
      if (Number.isInteger(page) && page > 0) out[page] = String(v ?? "");
    }
    return out;
  };

  if (s.startsWith("{")) {
    try {
      return toRecord(JSON.parse(s));
    } catch {
      try {
        const escaped = s.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        return toRecord(JSON.parse(escaped));
      } catch {}
    }
  }

  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const inner = JSON.parse(s);
      if (typeof inner === "string") {
        const innerTrim = inner.trim();
        if (innerTrim.startsWith("{")) {
          try {
            return toRecord(JSON.parse(innerTrim));
          } catch {
            const escaped = innerTrim.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
            return toRecord(JSON.parse(escaped));
          }
        }
      }
    } catch {}
  }

  return { 0: s };
}


function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHighlightTermsForText(text: string): string[] {
  const tl = String(text || "").toLowerCase();

  for (const key of Object.keys(FIELD_KEYWORDS)) {
    const kws = FIELD_KEYWORDS[key] || [];
    const matched = kws.filter((k) => tl.includes(k.toLowerCase()));
    if (!matched.length) continue;

    matched.sort((a, b) => {
      const aTitle = a.trim().startsWith("##") ? 1 : 0;
      const bTitle = b.trim().startsWith("##") ? 1 : 0;
      if (aTitle !== bTitle) return bTitle - aTitle;
      return b.length - a.length;
    });

    return matched.slice(0, 5);
  }

  return [];
}

function buildHighlightRegex(terms: string[]): RegExp | null {
  const clean = terms.map((x) => String(x || "").trim()).filter(Boolean);
  if (clean.length === 0) return null;

  clean.sort((a, b) => b.length - a.length);
  const pat = clean.map(escapeRegExp).join("|");
  return new RegExp(`(${pat})`, "giu");
}

function highlightPlainText(text: string, rx: RegExp | null): React.ReactNode[] {
  if (!rx) return [text];

  const parts: React.ReactNode[] = [];
  let last = 0;
  const s = String(text || "");
  rx.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = rx.exec(s))) {
    const start = m.index;
    const end = start + m[0].length;

    if (start > last) parts.push(s.slice(last, start));
    parts.push(
      <mark key={`hl-${start}-${end}-${parts.length}`} className={styles.hlMark}>
        {s.slice(start, end)}
      </mark>
    );
    last = end;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

/* =======================
   MarkdownPrettyView (com highlight)
   ======================= */

type MdBlock =
  | { type: "h"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; code: string };

function parseMdBlocks(md: string): MdBlock[] {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");

  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let ul: string[] | null = null;
  let ol: string[] | null = null;

  let inCode = false;
  let codeLines: string[] = [];

  function flushPara() {
    const text = para.join(" ").trim();
    if (text) blocks.push({ type: "p", text });
    para = [];
  }
  function flushUl() {
    if (ul && ul.length) blocks.push({ type: "ul", items: ul });
    ul = null;
  }
  function flushOl() {
    if (ol && ol.length) blocks.push({ type: "ol", items: ol });
    ol = null;
  }

  for (const lineRaw of lines) {
    const line = lineRaw ?? "";

    if (line.trim().startsWith("```")) {
      if (!inCode) {
        flushPara();
        flushUl();
        flushOl();
        inCode = true;
        codeLines = [];
      } else {
        inCode = false;
        blocks.push({ type: "code", code: codeLines.join("\n") });
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushUl();
      flushOl();
      continue;
    }

    const mH = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (mH) {
      flushPara();
      flushUl();
      flushOl();
      const level = Math.min(6, Math.max(1, mH[1].length)) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "h", level, text: mH[2] });
      continue;
    }

    const mUl = trimmed.match(/^[-*]\s+(.*)$/);
    if (mUl) {
      flushPara();
      flushOl();
      ul = ul || [];
      ul.push(mUl[1]);
      continue;
    }

    const mOl = trimmed.match(/^\d+\.\s+(.*)$/);
    if (mOl) {
      flushPara();
      flushUl();
      ol = ol || [];
      ol.push(mOl[1]);
      continue;
    }

    flushUl();
    flushOl();
    para.push(trimmed);
  }

  if (inCode && codeLines.length) blocks.push({ type: "code", code: codeLines.join("\n") });
  flushPara();
  flushUl();
  flushOl();

  return blocks;
}

function renderInline(text: string, rx: RegExp | null): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let s = String(text ?? "");

  while (s.length) {
    const idxCode = s.indexOf("`");
    const idxBold = s.indexOf("**");
    const idxIt = s.indexOf("*");

    let idx = -1;
    let type: "code" | "bold" | "it" | null = null;

    const candidates = [
      { idx: idxCode, type: "code" as const },
      { idx: idxBold, type: "bold" as const },
      { idx: idxIt, type: "it" as const },
    ].filter((c) => c.idx >= 0);

    if (candidates.length) {
      candidates.sort((a, b) => a.idx - b.idx);
      idx = candidates[0].idx;
      type = candidates[0].type;
    }

    if (idx < 0 || !type) {
      out.push(...highlightPlainText(s, rx));
      break;
    }

    if (idx > 0) out.push(...highlightPlainText(s.slice(0, idx), rx));

    if (type === "code") {
      const end = s.indexOf("`", idx + 1);
      if (end > idx) {
        const inner = s.slice(idx + 1, end);
        out.push(
          <code key={`c-${out.length}`} className={styles.mdInlineCode}>
            {inner}
          </code>
        );
        s = s.slice(end + 1);
        continue;
      }
    }

    if (type === "bold") {
      const end = s.indexOf("**", idx + 2);
      if (end > idx) {
        const inner = s.slice(idx + 2, end);
        out.push(
          <strong key={`b-${out.length}`} className={styles.mdStrong}>
            {highlightPlainText(inner, rx)}
          </strong>
        );
        s = s.slice(end + 2);
        continue;
      }
    }

    if (type === "it") {
      const end = s.indexOf("*", idx + 1);
      if (end > idx) {
        const inner = s.slice(idx + 1, end);
        out.push(
          <em key={`i-${out.length}`} className={styles.mdEm}>
            {highlightPlainText(inner, rx)}
          </em>
        );
        s = s.slice(end + 1);
        continue;
      }
    }

    out.push(s[idx]);
    s = s.slice(idx + 1);
  }

  return out;
}

function MarkdownPrettyView({ value, highlightTerms }: { value: string; highlightTerms?: string[] }) {
  const blocks = useMemo(() => parseMdBlocks(value), [value]);
  const rx = useMemo(() => buildHighlightRegex(highlightTerms || []), [highlightTerms]);

  return (
    <div className={styles.mdRoot}>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          const Tag = (`h${b.level}` as unknown) as keyof JSX.IntrinsicElements;
          const cls =
            b.level === 1
              ? styles.mdH1
              : b.level === 2
                ? styles.mdH2
                : b.level === 3
                  ? styles.mdH3
                  : styles.mdH4;
          return (
            <Tag key={i} className={cls}>
              {renderInline(b.text, rx)}
            </Tag>
          );
        }

        if (b.type === "p") {
          return (
            <p key={i} className={styles.mdP}>
              {renderInline(b.text, rx)}
            </p>
          );
        }

        if (b.type === "ul") {
          return (
            <ul key={i} className={styles.mdUl}>
              {b.items.map((it, k) => (
                <li key={k} className={styles.mdLi}>
                  {renderInline(it, rx)}
                </li>
              ))}
            </ul>
          );
        }

        if (b.type === "ol") {
          return (
            <ol key={i} className={styles.mdOl}>
              {b.items.map((it, k) => (
                <li key={k} className={styles.mdLi}>
                  {renderInline(it, rx)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <pre key={i} className={styles.mdCodeBlock}>
            <code>{b.code}</code>
          </pre>
        );
      })}
    </div>
  );
}

export default function ProcessoPdfPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const arquivoId = useMemo(() => Number(id), [id]);

  const [metadados, setMetadados] = useState<MetadadoRow[]>([]);
  const [eventos, setEventos] = useState<EventoRow[]>([]);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingEvt, setLoadingEvt] = useState(true);

  // ✅ sempre inicia em 1 (e só muda no “Ver no PDF”)
  const [pdfPage, setPdfPage] = useState<number>(1);

  // ✅ PDF baixado uma vez (evita tela branca ao trocar page)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfBlobLoading, setPdfBlobLoading] = useState(false);

  const [selectedEventoId, setSelectedEventoId] = useState<number | null>(null);
  const [openContent, setOpenContent] = useState<Record<string, boolean>>({});
  const pageCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const pdfBaseUrl = `/api/arquivos/${arquivoId}/pdf`;

  // ✅ carrega PDF 1 vez como blob (com cookie)
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function loadPdfBlob() {
      setPdfBlobLoading(true);
      try {
        const res = await fetch(pdfBaseUrl, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || "Erro ao carregar PDF.");
        }

        const blob = await res.blob();
        const nextUrl = URL.createObjectURL(blob);

        if (!alive) {
          URL.revokeObjectURL(nextUrl);
          return;
        }

        setPdfBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          toast.error(e?.message || "Falha ao carregar PDF.");
          setPdfBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (alive) setPdfBlobLoading(false);
      }
    }

    loadPdfBlob();

    return () => {
      alive = false;
      controller.abort();
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [pdfBaseUrl]);

  const pdfSrc = useMemo(() => {
    if (!pdfBlobUrl) return "";
    const page = pdfPage > 0 ? pdfPage : 1;
    return `${pdfBlobUrl}#page=${page}&zoom=page-fit`;
  }, [pdfBlobUrl, pdfPage]);

  async function loadMeta() {
    setLoadingMeta(true);
    try {
      const res = await fetch(`/api/arquivos/${arquivoId}/metadados`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar metadados.");
        setMetadados([]);
        return;
      }
      setMetadados(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha de rede ao carregar metadados.");
      setMetadados([]);
    } finally {
      setLoadingMeta(false);
    }
  }

  async function loadEventos() {
    setLoadingEvt(true);
    try {
      const res = await fetch(`/api/arquivos/${arquivoId}/eventos`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar eventos.");
        setEventos([]);
        return;
      }
      setEventos(Array.isArray(data) ? (data as EventoRow[]) : []);
    } catch {
      toast.error("Falha de rede ao carregar eventos.");
      setEventos([]);
    } finally {
      setLoadingEvt(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(arquivoId) || arquivoId <= 0) {
      toast.error("ID do arquivo inválido.");
      navigate("/app/processos");
      return;
    }
    setPdfPage(1); // ✅ inicial
    loadMeta();
    loadEventos();
  }, [arquivoId, navigate]);

  const docName = useMemo(() => {
    const pick = (k: string) => metadados.find((m) => m.nome === k)?.valor?.trim();
    return pick("upload.original_filename") || pick("pdf.title") || `Arquivo #${arquivoId}`;
  }, [metadados, arquivoId]);

  const eventosSorted = useMemo(() => {
    const score = (e: EventoRow) => {
      const isProcessed = normalizeStatus(e.status_nome) === "processado";
      const pages = isProcessed ? parsePagesLike(e.evento_pages_json) : [];
      const textObj = parseConteudoPaginasJson(e.evento_conteudo_paginas ?? null);
      const hasText = Object.values(textObj).some((v) => String(v ?? "").trim().length > 0);
      const hasInfo = hasText || pages.length > 0;
      return (hasInfo ? 1000 : 0) + (hasText ? 200 : 0) + (pages.length > 0 ? 150 : 0) + (isProcessed ? 50 : 0);
    };

    return [...eventos].sort((a, b) => {
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [eventos]);

  useEffect(() => {
    setSelectedEventoId((prev) => {
      if (eventosSorted.length === 0) return null;
      if (prev && eventosSorted.some((e) => e.id === prev)) return prev;
      return eventosSorted[0].id;
    });
  }, [eventosSorted]);

  const selectedEvento = useMemo(
    () => eventosSorted.find((e) => e.id === selectedEventoId) || null,
    [eventosSorted, selectedEventoId]
  );

  const selectedIsProcessed = useMemo(() => normalizeStatus(selectedEvento?.status_nome ?? null) === "processado", [
    selectedEvento?.status_nome,
  ]);

  const selectedPages = useMemo(() => {
    if (!selectedEvento) return [];
    if (!selectedIsProcessed) return [];
    return parsePagesLike(selectedEvento.evento_pages_json);
  }, [selectedEvento, selectedIsProcessed]);

  const selectedConteudoObj = useMemo(() => parseConteudoPaginasJson(selectedEvento?.evento_conteudo_paginas ?? null), [
    selectedEvento?.evento_conteudo_paginas,
  ]);

  const conteudoSections = useMemo(() => {
    if (!selectedEvento) return [];

    const keys = Object.keys(selectedConteudoObj)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    const onlyFallback =
      keys.length === 1 && keys[0] === 0 && (selectedConteudoObj[0] || "").trim().length > 0;

    if (onlyFallback) return [{ page: 0, text: String(selectedConteudoObj[0] ?? "") }];

    const order = selectedPages.length > 0 ? selectedPages : keys;

    return order
      .map((p) => ({ page: p, text: String(selectedConteudoObj[p] ?? "").trim() }))
      .filter((x) => x.text.length > 0);
  }, [selectedEvento, selectedConteudoObj, selectedPages]);

  useEffect(() => {
    if (conteudoSections.length === 0) {
      setOpenContent({});
      return;
    }
    const firstKey = `${conteudoSections[0].page}-0`;
    setOpenContent({ [firstKey]: true });
  }, [selectedEventoId, conteudoSections.length]);

  function toggleOpen(key: string) {
    setOpenContent((p) => ({ ...p, [key]: !p[key] }));
  }

  function goToPdfPage(p: number) {
    if (!Number.isFinite(p) || p <= 0) return;

    setPdfPage(p);

    const idx = conteudoSections.findIndex((s) => s.page === p);
    if (idx >= 0) {
      const key = `${p}-${idx}`;
      setOpenContent((prev) => ({ ...prev, [key]: true }));
      requestAnimationFrame(() => {
        pageCardRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function iconForEvento(e: EventoRow) {
    const iconSize = 18;
    const iconStroke = 3.6;

    const v = normalizeStatus(e.status_nome);
    const isProc = v === "processado";
    if (!isProc) return <Clock size={iconSize} strokeWidth={iconStroke} className={styles.iconProc} aria-hidden="true" />;

    const pages = parsePagesLike(e.evento_pages_json);
    if (pages.length > 0) return <CircleCheck size={iconSize} strokeWidth={iconStroke} className={styles.iconOk} aria-hidden="true" />;
    return <CircleX size={iconSize} strokeWidth={iconStroke} className={styles.iconBad} aria-hidden="true" />;
  }

  return (
    <div className={styles.page}>
      {/* (se você quiser renderizar o breadcrumb docName, pode usar aqui) */}
      {/* <div className={styles.breadcrumbFull}>{docName}</div> */}

      <div className={styles.header}>
        <button className={styles.backBtn} type="button" onClick={() => navigate("/app/processos")}>
          <ArrowLeft className={styles.btnIcon} aria-hidden="true" />
          Voltar
        </button>

        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <FileText className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Visualizar arquivo</h1>
            <p className={styles.subtitle}>PDF à esquerda, eventos (topo) e texto extraído (abaixo).</p>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* PDF */}
        <section className={styles.viewerCard} aria-label="Visualização do PDF">
          <div className={styles.viewerHeader}>
            <span className={styles.viewerTitle}>PDF</span>
            <div className={styles.viewerActions}>
              <a className={styles.viewerLink} href={pdfBaseUrl} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </div>
          </div>

          {/* ✅ wrapper: garante 100% de altura para o PDF */}
          <div className={styles.viewerBody}>
            {pdfBlobLoading ? (
              <div className={styles.state}>Carregando PDF...</div>
            ) : !pdfBlobUrl ? (
              <div className={styles.state}>
                Não foi possível carregar o PDF.
                <div style={{ marginTop: 8 }}>
                  <a href={pdfBaseUrl} target="_blank" rel="noreferrer">
                    Abrir em nova aba
                  </a>
                </div>
              </div>
            ) : (
              <object
                key={`${pdfBlobUrl}|${pdfPage}`} // ✅ evita "tela branca" em alguns browsers
                className={styles.pdfObject}
                data={pdfSrc}
                type="application/pdf"
                aria-label="PDF"
              >
                <div className={styles.state}>
                  Seu navegador não conseguiu exibir o PDF aqui.{" "}
                  <a href={pdfBaseUrl} target="_blank" rel="noreferrer">
                    Abrir em nova aba
                  </a>
                </div>
              </object>
            )}
          </div>
        </section>

        {/* Direita */}
        <aside className={styles.side} aria-label="Detalhes do arquivo">
          <section className={`${styles.card} ${styles.eventsTextCard}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Eventos</span>
            </div>

            <div className={styles.eventsStrip}>
              {loadingEvt ? (
                <div className={styles.state}>Carregando eventos...</div>
              ) : eventosSorted.length === 0 ? (
                <div className={styles.state}>Nenhum evento registrado para este arquivo.</div>
              ) : (
                <div className={styles.eventsScroller}>
                  {eventosSorted.map((e) => {
                    const active = e.id === selectedEventoId;
                    const tip = `${e.nome} — ${statusLabel(e.status_nome)}`;

                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={`${styles.eventTab} ${active ? styles.eventTabActive : ""}`}
                        onClick={() => setSelectedEventoId(e.id)}
                        title={tip}
                        aria-label={tip}
                      >
                        <span className={styles.eventTabIcon}>{iconForEvento(e)}</span>
                        <span className={styles.eventTabText}>{e.nome}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.eventsBody}>
              {!selectedEvento ? (
                <div className={styles.state}>Selecione um evento acima.</div>
              ) : (
                <>
                    <h2 className={styles.eventTitleOnly}>{selectedEvento.nome}</h2>

                  {conteudoSections.length === 0 ? (
                    <div className={styles.state}>Nenhum conteúdo textual disponível para este evento.</div>
                  ) : (
                    <div className={styles.pageBlocksWrap}>
                      {conteudoSections.map((sec, idx) => {
                        const key = `${sec.page}-${idx}`;
                        const isOpen = !!openContent[key];

                        // ✅ agora marca assim que o conteúdo estiver aberto (não depende do pdfPage)
                        const highlightTerms = isOpen ? getHighlightTermsForText(sec.text) : [];

                        return (
                          <div
                            key={key}
                            className={styles.pageSection}
                            ref={(el) => {
                              pageCardRefs.current[key] = el;
                            }}
                          >
                            <div
                              className={styles.pageSectionHeaderBtn}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleOpen(key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleOpen(key);
                                }
                              }}
                              title={isOpen ? "Recolher" : "Expandir"}
                            >
                              <span className={styles.pageSectionHeaderTitle}>
                                {sec.page > 0 ? `Página ${sec.page}` : "Texto"}
                              </span>

                              <span className={styles.pageSectionHeaderRight}>
                                {sec.page > 0 ? (
                                  <button
                                    type="button"
                                    className={styles.goPdfBtn}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      goToPdfPage(sec.page);
                                    }}
                                    title="Ir para esta página no PDF"
                                  >
                                    Ver no PDF
                                  </button>
                                ) : null}

                                {isOpen ? <ChevronUp className={styles.chev} aria-hidden="true" /> : <ChevronDown className={styles.chev} aria-hidden="true" />}
                              </span>
                            </div>

                            {isOpen ? (
                              <div className={styles.pageSectionBody}>
                                <MarkdownPrettyView value={sec.text} highlightTerms={highlightTerms} />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}