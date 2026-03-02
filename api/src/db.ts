import sql from "mssql";

const dbConfig: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER || "150.165.75.52",
  port: Number(process.env.DB_PORT || 1434),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000000000
  },
  options: {
    // Para dev local com Docker normalmente é self-signed.
    // Em produção: encrypt=true e trustServerCertificate=false com certificado válido.
    encrypt: false,
    trustServerCertificate: true
  }
};

let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(dbConfig);
  return pool;
}

export { sql };
