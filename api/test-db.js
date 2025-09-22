// 📁 test-db.js
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "cp1740_harvestuser",
  password: process.env.DB_PASS || "harvestuser@2025",
  database: process.env.DB_NAME || "sc2djem5820_harvestdb",
});

async function testConnection() {
  try {
    await client.connect();
    console.log("✅ Connexion réussie à PostgreSQL !");
    const res = await client.query("SELECT NOW()");
    console.log("Heure serveur PostgreSQL :", res.rows[0].now);
  } catch (err) {
    console.error("❌ Erreur de connexion PostgreSQL :", err.message);
  } finally {
    await client.end();
  }
}

testConnection();
