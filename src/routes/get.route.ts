import express, { Request, Response, Router } from "express";
import db from "../data/db";
import path from "path";
import { WEB_ROOT } from "../server.main";

const router: Router = express.Router();

router.get("/", (req, res) => {
  res.type("html");
  res.status(200).sendFile(WEB_ROOT);
});

router.get("/api/weather/latest", async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT ID, temperature, humidity, wind_speed, wind_direction, precipitation,
             DATE_FORMAT(\`timestamp\`, '%Y-%m-%dT%H:%i:%s') AS \`timestamp\`
      FROM weather
      ORDER BY \`timestamp\` DESC
      LIMIT 1
      `
    );

    // mysql2 gibt rows als any[] zurück
    const arr = rows as any[];
    if (!arr.length) return res.status(200).json({ message: "no data" });

    return res.status(200).json(arr[0]);
  } catch {
    return res.status(500).json({ message: "server error" });
  }
});


router.get("/api/weather", async (req: Request, res: Response) => {
  try {
    const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    const startParam = req.query.start != null ? String(req.query.start) : null;
    const endParam = req.query.end != null ? String(req.query.end) : null;

    const mode = req.query.mode != null ? String(req.query.mode) : null;
    const dayParam = req.query.day != null ? String(req.query.day) : null;

    const everySecRaw = req.query.everySec != null ? Number(req.query.everySec) : null;
    const everySec =
      everySecRaw != null && Number.isFinite(everySecRaw) && everySecRaw >= 10 && everySecRaw <= 86400
        ? Math.floor(everySecRaw)
        : null;

    // NEW: Range-Query (für Wochenansicht: ALLE Datensätze im Zeitraum)
    if (startParam || endParam) {
      if (!startParam || !endParam) {
        return res.status(400).json({ message: "start and end required (YYYY-MM-DD)" });
      }
      if (!isYmd(startParam)) return res.status(400).json({ message: "start must be YYYY-MM-DD" });
      if (!isYmd(endParam)) return res.status(400).json({ message: "end must be YYYY-MM-DD" });

      if (!everySec) {
        const [rows] = await db.execute(
          `
          SELECT
            ID, temperature, humidity, wind_speed, wind_direction, precipitation,
            DATE_FORMAT(\`timestamp\`, '%Y-%m-%dT%H:%i:%s') AS \`timestamp\`
          FROM weather
          WHERE \`timestamp\` >= ?
            AND \`timestamp\` <  DATE_ADD(?, INTERVAL 1 DAY)
          ORDER BY \`timestamp\` ASC
          `,
          [startParam, endParam]
        );
        return res.status(200).json(rows);
      }

      // Optional: Downsampling (z.B. everySec=60 / 300 / 900 ...)
      const [rows] = await db.execute(
        `
        SELECT
          MIN(ID) AS ID,
          ROUND(AVG(temperature), 1) AS temperature,
          ROUND(AVG(humidity), 0) AS humidity,
          ROUND(AVG(wind_speed), 2) AS wind_speed,
          MOD(
            ROUND(
              DEGREES(
                ATAN2(
                  AVG(SIN(RADIANS(wind_direction))),
                  AVG(COS(RADIANS(wind_direction)))
                )
              ) + 360
            ),
            360
          ) AS wind_direction,
          ROUND(SUM(precipitation), 2) AS precipitation,
          DATE_FORMAT(
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(\`timestamp\`) / ?) * ?),
            '%Y-%m-%dT%H:%i:%s'
          ) AS \`timestamp\`
        FROM weather
        WHERE \`timestamp\` >= ?
          AND \`timestamp\` <  DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY FLOOR(UNIX_TIMESTAMP(\`timestamp\`) / ?)
        ORDER BY FLOOR(UNIX_TIMESTAMP(\`timestamp\`) / ?) ASC
        `,
        [everySec, everySec, startParam, endParam, everySec, everySec]
      );

      return res.status(200).json(rows);
    }

    // LEGACY: mode=hourly|daily (optional behalten)
    if (mode && mode !== "hourly" && mode !== "daily") {
      return res.status(400).json({ message: "mode must be hourly|daily" });
    }

    if (mode === "hourly") {
      if (dayParam && !isYmd(dayParam)) {
        return res.status(400).json({ message: "day must be YYYY-MM-DD" });
      }

      if (!dayParam) {
        const [rows] = await db.execute(`
          SELECT
            ID, temperature, humidity, wind_speed, wind_direction, precipitation,
            DATE_FORMAT(\`timestamp\`, '%Y-%m-%dT%H:%i:%s') AS \`timestamp\`
          FROM weather
          WHERE \`timestamp\` >= CURDATE()
            AND \`timestamp\` <  DATE_ADD(CURDATE(), INTERVAL 1 DAY)
          ORDER BY \`timestamp\` ASC
        `);
        return res.status(200).json(rows);
      }

      const [rows] = await db.execute(
        `
        SELECT
          ID, temperature, humidity, wind_speed, wind_direction, precipitation,
          DATE_FORMAT(\`timestamp\`, '%Y-%m-%dT%H:%i:%s') AS \`timestamp\`
        FROM weather
        WHERE \`timestamp\` >= ?
          AND \`timestamp\` <  DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY \`timestamp\` ASC
        `,
        [dayParam, dayParam]
      );
      return res.status(200).json(rows);
    }

    if (mode === "daily") {
      const endLegacy = req.query.end != null ? String(req.query.end) : null;
      if (endLegacy && !isYmd(endLegacy)) {
        return res.status(400).json({ message: "end must be YYYY-MM-DD" });
      }

      const endDay = endLegacy ?? new Date().toISOString().slice(0, 10);

      const [rows] = await db.execute(
        `
        SELECT
          ID, temperature, humidity, wind_speed, wind_direction, precipitation,
          DATE_FORMAT(\`timestamp\`, '%Y-%m-%dT%H:%i:%s') AS \`timestamp\`
        FROM weather
        WHERE \`timestamp\` >= DATE_SUB(?, INTERVAL 6 DAY)
          AND \`timestamp\` <  DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY \`timestamp\` ASC
        `,
        [endDay, endDay]
      );
      return res.status(200).json(rows);
    }

    return res.status(400).json({ message: "use start/end or mode" });
  } catch {
    return res.status(500).json({ message: "server error" });
  }
});


export default router;
