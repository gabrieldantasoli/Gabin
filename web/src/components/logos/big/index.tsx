import styles from "./index.module.css";

export function Logo() {
  return (
    <div className={styles.wrap} aria-label="GabIt - Gabinetes Inteligentes">
      <div className={styles.brand}>
        <div>
          <span className={styles.gab}>Gab</span>
          <span className={styles.in}>
            <span className={styles.iWrap}>
              <span className={styles.iChar}>I</span>
              <span className={styles.iStar} aria-hidden="true">★</span>
            </span>
          </span>
        </div>

        <div className={styles.subtitle}>
          <span className={styles.subBlue}>
            <span className={styles.subGreen}>Gabinetes</span>{" "}
            <span className={styles.subYellow}>Inteligentes</span>
          </span>
        </div>
      </div>
    </div>
  );
}
