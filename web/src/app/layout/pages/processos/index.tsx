import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Files,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Eye,
  CircleCheck,
  CircleX,
  Clock,
} from "lucide-react";
import styles from "./index.module.css";

type ArquivoRow = {
  id: number;
  nome_processo: string;
  descricao: string | null;
  status_arquivo_id: number;
  status_nome: string;
  gabinete_id: number;
  gabinete_nome: string;
  created_at: string;
};

type StatusRow = { id: number; nome: string };
type GabineteRow = { id: number; nome: string };

type SortMode = "recent" | "oldest" | "az" | "za";

type EventoRow = {
  id: number;
  nome: string;
  pages_json: any; // string JSON, array, null...
};

function normalizeKey(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parsePagesLike(v: any): number[] {
  if (v == null) return [];

  if (Array.isArray(v)) {
    return v
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];

    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .map((x) => Number(x))
            .filter((n) => Number.isInteger(n) && n > 0);
        }
        return [];
      } catch {
        // cai pro CSV abaixo
      }
    }

    // CSV "1,2,3"
    return s
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  return [];
}

function normalizeEvento(raw: any): EventoRow | null {
  const nome = String(raw?.evento_nome ?? raw?.nome_evento ?? raw?.nome ?? raw?.evento ?? "").trim();
  if (!nome) return null;

  const pages_json =
    raw?.evento_pages_json ??
    raw?.evento_paginas_json ??
    raw?.pages_json ??
    raw?.pages ??
    raw?.paginas ??
    null;

  const id = Number(raw?.id ?? 0) || 0;

  return { id, nome, pages_json };
}

export default function ProcessosPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ArquivoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [gabs, setGabs] = useState<GabineteRow[]>([]);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [gabFilter, setGabFilter] = useState<number | "all">("all");

  const [pageSize, setPageSize] = useState<5 | 10 | 20 | 30>(10);
  const [page, setPage] = useState(1);

  // Eventos por arquivo
  const [eventosByArquivo, setEventosByArquivo] = useState<Record<number, EventoRow[]>>({});
  const [eventosLoading, setEventosLoading] = useState<Record<number, boolean>>({});

  async function loadLookups() {
    try {
      const [stRes, gbRes] = await Promise.all([
        fetch("/api/status-arquivo", { credentials: "include", cache: "no-store" }),
        fetch("/api/gabinetes/accessible", { credentials: "include", cache: "no-store" }),
      ]);

      const st = await stRes.json().catch(() => []);
      const gb = await gbRes.json().catch(() => []);

      if (stRes.ok) setStatuses(Array.isArray(st) ? st : []);
      if (gbRes.ok) setGabs((Array.isArray(gb) ? gb : []).map((x: any) => ({ id: x.id, nome: x.nome })));
    } catch {
      // lookups não são críticos
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/arquivos", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(data?.message || "Erro ao carregar processos.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha de rede ao carregar processos.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadEventosForArquivo(arquivoId: number) {
    // já carregado
    if (Object.prototype.hasOwnProperty.call(eventosByArquivo, arquivoId)) return;
    // já carregando
    if (eventosLoading[arquivoId]) return;

    setEventosLoading((p) => ({ ...p, [arquivoId]: true }));
    try {
      // Ajuste esta URL se seu backend usar outra rota
      const res = await fetch(`/api/arquivos/${arquivoId}/eventos`, {
        credentials: "include",
        cache: "no-store",
      });

      const payload = await res.json().catch(() => []);
      if (!res.ok) {
        setEventosByArquivo((p) => ({ ...p, [arquivoId]: [] }));
        return;
      }

      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.eventos)
            ? payload.eventos
            : [];

      const norm = list.map(normalizeEvento).filter(Boolean) as EventoRow[];
      setEventosByArquivo((p) => ({ ...p, [arquivoId]: norm }));
    } catch {
      setEventosByArquivo((p) => ({ ...p, [arquivoId]: [] }));
    } finally {
      setEventosLoading((p) => ({ ...p, [arquivoId]: false }));
    }
  }

  // Prefetch eventos de todos os processos (com limite de concorrência simples)
  useEffect(() => {
    let cancelled = false;

    async function prefetchAll() {
      const ids = items.map((x) => x.id);
      const missing = ids.filter(
        (id) => !Object.prototype.hasOwnProperty.call(eventosByArquivo, id) && !eventosLoading[id]
      );

      if (missing.length === 0) return;

      const limit = 6;
      let idx = 0;

      async function worker() {
        while (!cancelled) {
          const cur = missing[idx++];
          if (!cur) return;
          await loadEventosForArquivo(cur);
        }
      }

      const workers = Array.from({ length: Math.min(limit, missing.length) }, () => worker());
      await Promise.all(workers);
    }

    prefetchAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    loadLookups();
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, sort, statusFilter, gabFilter, pageSize]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let arr = [...items];

    if (query) {
      arr = arr.filter((a) => {
        const x = (a.nome_processo || "").toLowerCase();
        const y = (a.descricao || "").toLowerCase();
        const z = (a.gabinete_nome || "").toLowerCase();
        const w = (a.status_nome || "").toLowerCase();
        return x.includes(query) || y.includes(query) || z.includes(query) || w.includes(query);
      });
    }

    if (statusFilter !== "all") {
      arr = arr.filter((a) => a.status_arquivo_id === statusFilter);
    }

    if (gabFilter !== "all") {
      arr = arr.filter((a) => a.gabinete_id === gabFilter);
    }

    switch (sort) {
      case "az":
        arr.sort((x, y) => x.nome_processo.localeCompare(y.nome_processo));
        break;
      case "za":
        arr.sort((x, y) => y.nome_processo.localeCompare(x.nome_processo));
        break;
      case "oldest":
        arr.sort((x, y) => x.id - y.id);
        break;
      case "recent":
      default:
        arr.sort((x, y) => y.id - x.id);
        break;
    }

    return arr;
  }, [items, q, sort, statusFilter, gabFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function prevPage() {
    setPage((p) => Math.max(1, p - 1));
  }
  function nextPage() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  async function openPdf(id: number) {
    try {
      const res = await fetch(`/api/arquivos/${id}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || "Erro ao abrir PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Falha de rede ao abrir PDF.");
    }
  }

  function openView(id: number, nomeProcesso: string) {
    navigate(`/gabin/app/processos/${id}`, {
      state: { breadcrumb: nomeProcesso },
    });
  }

  // Colunas dinâmicas (eventos) — união de todos eventos carregados
  const eventColumns = useMemo(() => {
    const map = new Map<string, string>(); // key normalizada -> label original
    Object.values(eventosByArquivo).forEach((list) => {
      for (const ev of list) {
        const key = normalizeKey(ev.nome);
        if (!key) continue;
        if (!map.has(key)) map.set(key, ev.nome);
      }
    });

    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [eventosByArquivo]);

  function renderEventoMark(arquivoId: number, colKey: string, colLabel: string) {
    const iconSize = 22;
    const iconStroke = 3.6;

    const hasLoaded = Object.prototype.hasOwnProperty.call(eventosByArquivo, arquivoId);

    // Processando (ainda não carregou ou está carregando)
    if (!hasLoaded || eventosLoading[arquivoId]) {
      return (
        <span className={styles.iconWrap} title={`${colLabel} — processando`} aria-label={`${colLabel} — processando`}>
          <Clock size={iconSize} strokeWidth={iconStroke} style={{ color: "#64748b" }} />
        </span>
      );
    }

    const list = eventosByArquivo[arquivoId] || [];
    const ev = list.find((x) => normalizeKey(x.nome) === colKey);

    // Sem o evento ainda (processando)
    if (!ev) {
      return (
        <span className={styles.iconWrap} title={`${colLabel} — processando`} aria-label={`${colLabel} — processando`}>
          <Clock size={iconSize} strokeWidth={iconStroke} style={{ color: "#64748b" }} />
        </span>
      );
    }

    const pages = parsePagesLike(ev.pages_json);

    // Com páginas
    if (pages.length > 0) {
      return (
        <span className={styles.iconWrap} title={`${colLabel} — com páginas`} aria-label={`${colLabel} — com páginas`}>
          <CircleCheck size={iconSize} strokeWidth={iconStroke} style={{ color: "#16a34a" }} />
        </span>
      );
    }

    // Evento existe, mas sem páginas
    return (
      <span className={styles.iconWrap} title={`${colLabel} — sem páginas`} aria-label={`${colLabel} — sem páginas`}>
        <CircleX size={iconSize} strokeWidth={iconStroke} style={{ color: "#dc2626" }} />
      </span>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.titleIcon}>
            <Files className={styles.icon} aria-hidden="true" />
          </div>
          <div>
            <h1 className={styles.title}>Processos</h1>
            <p className={styles.subtitle}>Liste e cadastre arquivos (PDF) vinculados aos gabinetes.</p>
          </div>
        </div>

        <button className={styles.primaryBtn} onClick={() => navigate("/gabin/app/processos/novo")} type="button">
          <Plus className={styles.btnIcon} aria-hidden="true" />
          Adicionar arquivos
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por processo"
          />
        </div>

        <div className={styles.sort}>
          <SlidersHorizontal className={styles.sortIcon} aria-hidden="true" />
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </select>
        </div>

        <div className={styles.sort}>
          <span className={styles.pagerLabel}>Por página</span>
          <select className={styles.select} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as any)}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
          </select>
        </div>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.state}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.state}>Nenhum processo encontrado.</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Gabinete</th>

                  {eventColumns.map((c) => (
                    <th key={c.key} className={styles.thEvento} title={c.label}>
                      <span className={styles.thEventoText}>{c.label}</span>
                    </th>
                  ))}

                  <th className={styles.thActions}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.tdStrong}>{a.nome_processo}</td>
                    <td className={styles.tdMuted}>{a.gabinete_nome}</td>

                    {eventColumns.map((c) => (
                      <td key={c.key} className={styles.tdEvento}>
                        {renderEventoMark(a.id, c.key, c.label)}
                      </td>
                    ))}

                    <td className={styles.tdActions}>
                      <div className={styles.actions}>
                        <button
                          className={styles.ghostBtn}
                          type="button"
                          onClick={() => openView(a.id, a.nome_processo)}
                          title="Ver detalhes"
                          aria-label="Ver detalhes"
                        >
                          <Eye className={styles.btnIcon} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.tableFooter}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={prevPage}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className={styles.pageIcon} aria-hidden="true" />
              </button>

              <span className={styles.pageInfo}>
                Página <b>{page}</b> de <b>{totalPages}</b>
              </span>

              <button
                type="button"
                className={styles.pageBtn}
                onClick={nextPage}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight className={styles.pageIcon} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
