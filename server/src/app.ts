import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { apiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { createCorsOptions } from "./lib/cors";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(cors(createCorsOptions(env.CLIENT_ORIGIN, env.NODE_ENV)));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRouter);

// Must be registered after all routes — Express identifies error-handling
// middleware by its four-argument signature.
app.use(errorHandler);
