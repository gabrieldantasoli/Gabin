// Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import styles from "./Sidebar.module.css";
import { Logo } from "../logos/small";
import { Building2 } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

function IconSair() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path
        d="M10 17l5-5-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12H3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 3v18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type GabineteRow = Record<string, any>;

function pickGabineteNome(row: GabineteRow | null | undefined): string | null {
  if (!row) return null;

  // tenta alguns nomes comuns de colunas
  const candidates = [
    row.gabinete_nome,
    row.nome_gabinete,
    row.nome,
    row.descricao,
    row.gabinete,
  ];

  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }

  // fallback: tenta achar qualquer campo string com "gabinete" no nome
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase().includes("gabinete")) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
  }

  return null;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const logout = auth?.logout;

  const user = auth?.user ?? auth?.me ?? auth?.currentUser ?? null;

  const fallbackGabineteNome: string = useMemo(() => {
    return (
      user?.gabinete_nome ??
      user?.gabineteNome ??
      user?.gabinete?.nome ??
      user?.gabinete?.nome_gabinete ??
      user?.gabinete ??
      "Gabinete"
    );
  }, [user]);

  const [gabineteNome, setGabineteNome] = useState<string>(fallbackGabineteNome);

  // ✅ sua rota do backend
  const GABINETES_URL = "/api/gabinetes"; // se for "/gabinetes", troque aqui

  useEffect(() => {
    const controller = new AbortController();

    async function loadFirstGabinete() {
      try {
        const res = await fetch(GABINETES_URL, {
          method: "GET",
          credentials: "include", // importante para requireAuth via cookie/sessão
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!res.ok) {
          // tenta ler erro padronizado {error, message}
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.message || `Erro ao buscar gabinetes (${res.status}).`);
        }

        const data = (await res.json().catch(() => [])) as GabineteRow[];

        if (Array.isArray(data) && data.length > 0) {
          const nome = pickGabineteNome(data[0]);
          if (nome) setGabineteNome(nome);
          else setGabineteNome(fallbackGabineteNome);
        } else {
          setGabineteNome(fallbackGabineteNome);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          // não “spamma” toast se preferir silencioso; mantive leve:
          // toast.error(e?.message || "Falha ao carregar gabinetes.");
          setGabineteNome(fallbackGabineteNome);
        }
      }
    }

    // sempre tenta buscar, mas mantém fallback caso falhe
    loadFirstGabinete();

    return () => controller.abort();
  }, [GABINETES_URL, fallbackGabineteNome]);

  async function handleLogout() {
    try {
      await logout?.();
    } finally {
      toast.success("Sessão encerrada.");
      navigate("/login", { replace: true });
    }
  }

  return (
    <header className={styles.sidebar} aria-label="Cabeçalho">
      <div className={styles.left}>
        <NavLink
          to="/gabin/app/processos"
          className={styles.logoLink}
          aria-label="Ir para Processos"
          style={{ textDecoration: "none" }}
        >
          <div className={styles.logoWrap} aria-hidden="true">
            <Logo />
          </div>
        </NavLink>
      </div>

      <div className={styles.right}>
        <div className={styles.gabinetePill} title={gabineteNome}>
          <Building2 className={styles.gabIcon} aria-hidden="true" />
          <span className={styles.gabText}>{gabineteNome}</span>
        </div>

        <button className={styles.logout} onClick={handleLogout} type="button">
          <IconSair />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}