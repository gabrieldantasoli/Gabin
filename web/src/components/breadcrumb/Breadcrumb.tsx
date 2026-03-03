import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import styles from "./Breadcrumb.module.css";

const LABELS: Record<string, string> = {
  app: "Início",
  processos: "Processos",
  gabinetes: "Gabinetes",
  "meus-gabinetes": "Meus Gabinetes",
  solicitacoes: "Solicitações",
  favoritos: "Favoritos",
  "meus-acessos": "Meus Acessos",
};

function isNumeric(seg: string) {
  return /^\d+$/.test(seg);
}

function prettyLabel(seg: string) {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export default function Breadcrumb() {
  const location = useLocation();

  const prefix = "/gabin";

  // remove /gabin do pathname só para montar os segmentos do breadcrumb
  const rawPath = location.pathname.startsWith(prefix + "/")
    ? location.pathname.slice(prefix.length)
    : location.pathname;

  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // opcional: a página pode passar um label humano pro último crumb via state
  const stateAny = location.state as any;
  const lastLabelFromState =
    typeof stateAny?.breadcrumb === "string" && stateAny.breadcrumb.trim()
      ? stateAny.breadcrumb.trim()
      : null;

  let acc = "";

  return (
    <nav className={styles.breadcrumb} aria-label="breadcrumb">
      {segments.map((seg, i) => {
        acc += `/${seg}`;
        const isLast = i === segments.length - 1;
        const prev = i > 0 ? segments[i - 1] : "";

        // links SEMPRE com prefixo /gabin
        const fullTo = `${prefix}${acc}`;

        // “Início” vai pro home
        const to = seg === "app" ? `${prefix}/app/home` : fullTo;

        // label
        let label = LABELS[seg] ?? prettyLabel(seg);

        // se for id numérico, melhora o label
        if (isNumeric(seg)) {
          if (isLast && lastLabelFromState) {
            label = lastLabelFromState; // ex.: nome do processo/arquivo
          } else if (prev === "processos") {
            label = `Processo ${seg}`;
          } else if (prev === "gabinetes") {
            label = `Gabinete ${seg}`;
          } else {
            label = `#${seg}`;
          }
        }

        return (
          <span className={styles.crumb} key={fullTo}>
            {i > 0 && <ChevronRight className={styles.sep} aria-hidden="true" />}
            {isLast ? (
              <span className={styles.current}>{label}</span>
            ) : (
              <Link className={styles.link} to={to}>
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}