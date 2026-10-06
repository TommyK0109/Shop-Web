import { PrismaClient } from "@prisma/client";

// Reused across the process instead of one client per import — a fresh
// PrismaClient per request would exhaust the DB connection pool.
export const prisma = new PrismaClient();
