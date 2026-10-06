import { Router } from "express";
import { ragRequestSchema } from "@storefront/shared";
import { env } from "../env";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { handleRag } from "../controllers/rag.controller";

export const ragRouter = Router();
ragRouter.get("/capabilities", (_req, res) => res.json({ enabled: env.RAG_ENABLED, generationEnabled: env.RAG_ENABLED && env.RAG_GENERATION_ENABLED }));
ragRouter.post("/search", requireAuth, validate(ragRequestSchema), asyncHandler((req, res) => handleRag(req, res, false)));
ragRouter.post("/answer", requireAuth, validate(ragRequestSchema), asyncHandler((req, res) => handleRag(req, res, true)));
