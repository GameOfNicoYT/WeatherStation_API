// Datei: src/routes/pushData.route.ts
import express, { Request, Response, Router } from "express";
import db from "../data/db";

const router: Router = express.Router();

type PushBody = {
  temperature: unknown;
  humidity: unknown;
  wind_speed: unknown;
  wind_direction: unknown;
  precipitation: unknown;
  timestamp?: unknown; // optional
};

const toNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

router.post("/api/pushData", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as PushBody;

    const requiredFields: (keyof PushBody)[] = [
      "temperature",
      "humidity",
      "wind_speed",
      "wind_direction",
      "precipitation",
    ];

    const missing = requiredFields.filter(
      (k) => !(k in (body as any)) || (body as any)[k] == null
    );

    if (missing.length) {
      return res.status(400).json({
        message: "missing fields",
        missing,
      });
    }

    const temperature = toNumber(body.temperature);
    const humidity = toNumber(body.humidity);
    const wind_speed = toNumber(body.wind_speed);
    const wind_direction = toNumber(body.wind_direction);
    const precipitation = toNumber(body.precipitation);

    if (
      temperature == null ||
      humidity == null ||
      wind_speed == null ||
      wind_direction == null ||
      precipitation == null
    ) {
      return res.status(400).json({ message: "invalid field types" });
    }

    let ts: Date | null = null;
    if (body.timestamp != null) {
      if (typeof body.timestamp !== "string") {
        return res.status(400).json({ message: "timestamp must be ISO string" });
      }
      ts = new Date(body.timestamp);
      if (Number.isNaN(ts.getTime())) {
        return res.status(400).json({ message: "timestamp invalid" });
      }
    }

    if (ts) {
      await db.execute(
        `
        INSERT INTO weather
          (temperature, humidity, wind_speed, wind_direction, precipitation, \`timestamp\`)
        VALUES
          (?, ?, ?, ?, ?, ?)
        `,
        [
          temperature,
          Math.round(humidity),
          wind_speed,
          Math.round(wind_direction),
          precipitation,
          ts,
        ]
      );
    } else {
      await db.execute(
        `
        INSERT INTO weather
          (temperature, humidity, wind_speed, wind_direction, precipitation, \`timestamp\`)
        VALUES
          (?, ?, ?, ?, ?, NOW())
        `,
        [
          temperature,
          Math.round(humidity),
          wind_speed,
          Math.round(wind_direction),
          precipitation,
        ]
      );
    }

    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "server error" });
  }
});

export default router;
