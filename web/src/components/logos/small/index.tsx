import styles from "./index.module.css";

export function Logo() {
  return (
    <div className={styles.wrap} aria-label="GabIn - Gabinetes Inteligentes">
      <div className={styles.brand}>
        <span className={styles.gab}>Gab</span>
        <span className={styles.in}>
          <span className={styles.iWrap}>
            <span className={styles.iChar}>I</span>
            <span className={styles.iStar} aria-hidden="true">
              ★
            </span>
          </span>
        </span>
      </div>
      <div className={styles.images}>
        <img
          className={styles.logoImage1}
          src={`${import.meta.env.BASE_URL}logo_oficial_tce_ac.png`}
          alt="Logo TCE-AC"
          draggable={false}
        />
        <img
          className={styles.logoImage2}
          src={`${import.meta.env.BASE_URL}logo-lsi-ufcg.png`}
          alt="Logo LSI"
          draggable={false}
        />
      </div>
    </div>
  );
}
