// Datei: src/server.main.ts
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import GetRoute from "./routes/get.route";
import PostRoute from "./routes/post.route";
import { insureDBSetup } from "./data/db";

export const WEB_ROOT = path.resolve(__dirname, "web/index.html");

const PORT: number = Number(process.env.PORT) || 5500;
const app = express();

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cors());
app.use(express.json())

app.use(GetRoute);
app.use(PostRoute);

async function bootstrap() {
  await insureDBSetup().then((retVal) => {
    if (retVal != 0) return;

    console.log("⏳ Starting Server...\n")
    app.listen(PORT, (err) => {
      if (!err) console.log("✅ Server running on Port ", PORT);
      else console.log(err?.message);
    });
  });
}

bootstrap().catch((e) => {
  console.error("❌ DB Setup failed:", e);
  process.exit(1);
});
