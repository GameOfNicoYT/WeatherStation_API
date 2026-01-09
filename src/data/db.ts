// Datei: src/data/db.ts
import mysql from "mysql2/promise";
import { escape, escapeId } from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE ?? "weatherstation",
});

const adminDb = mysql.createPool({
  host: process.env.HOST,
  user: process.env.ADMIN_USER ?? process.env.USER,
  password: process.env.ADMIN_PASSWORD ?? process.env.PASSWORD,
});

export async function insureDBSetup(): Promise<number> {
  try {
    console.log("⏳ Checking DB setup...\n\n");

    const dbName = process.env.DATABASE ?? "weatherstation";
    const tableName = "weather";

    const appUser =
      process.env.DB_GRANT_USER ?? process.env.USER ?? "weatherstation";
    const appHost = process.env.DB_GRANT_HOST ?? "%";
    const appPass = process.env.DB_GRANT_PASSWORD ?? process.env.PASSWORD;

    if (!appUser) throw new Error("USER/DB_GRANT_USER fehlt in .env");
    if (!appPass) throw new Error("PASSWORD/DB_GRANT_PASSWORD fehlt in .env");

    const dbId = escapeId(dbName);
    const tblId = escapeId(tableName);
    const fullTable = `${dbId}.${tblId}`;
    const grantee = `${escape(appUser)}@${escape(appHost)}`;

    console.log(`⏳ Creating DATABASE ${dbName} if it doesn't exist...`);
    await adminDb.execute(
      `CREATE DATABASE IF NOT EXISTS ${dbId} DEFAULT CHARACTER SET utf8mb4;`
    );
    console.log(`✅ DATABASE ${dbName} EXISTS OR WAS CREATED\n`);

    console.log("⏳ Creating TABLE `weather` if it doesn't exist...");
    await adminDb.execute(`
    CREATE TABLE IF NOT EXISTS ${fullTable} (
      \`ID\` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      \`temperature\` FLOAT NOT NULL,
      \`humidity\` INT(11) NOT NULL,
      \`wind_speed\` INT(11) NOT NULL,
      \`wind_direction\` INT(11) NOT NULL,
      \`precipitation\` INT(11) NOT NULL,
      \`timestamp\` TIMESTAMP NOT NULL,
      PRIMARY KEY (\`ID\`),
      INDEX \`idx_timestamp\` (\`timestamp\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    console.log("✅ TABLE `weather` EXISTS OR WAS CREATED\n");

    console.log(
      `⏳ Creating USER ${appUser}@${appHost} if it doesn't exist...`
    );
    await adminDb.execute(
      `CREATE USER IF NOT EXISTS ${grantee} IDENTIFIED BY ${escape(appPass)};`
    );
    console.log(`✅ USER \`${appUser}|${appHost}\` EXISTS OR WAS CREATED\n`);

    console.log(`⏳ Ensuring USER password is set...`);
    await adminDb.execute(
      `ALTER USER ${grantee} IDENTIFIED BY ${escape(appPass)};`
    );
    console.log(`✅ USER password is set\n`);

    console.log(`⏳ Granting rights on ${dbName}.${tableName} ...`);
    await adminDb.execute(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${fullTable} TO ${grantee};`
    );
    await adminDb.execute(`FLUSH PRIVILEGES;`);
    console.log(`✅ GRANTED USER \`${appUser}|${appHost}\` rights on ${dbName}.${tableName}\n`);

    console.log("✅ DB setup done.\n\n");
    return 0;
  } catch (err) {
    console.log(err);
    return -1;
  }
}

export default db;
