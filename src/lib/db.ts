import { PrismaClient } from "@prisma/client";

// One PrismaClient per server instance. In development the module is re-evaluated on every hot
// reload, so the client is kept on globalThis to avoid exhausting database connections; on Vercel
// each serverless instance reuses the same module-level client across requests.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
