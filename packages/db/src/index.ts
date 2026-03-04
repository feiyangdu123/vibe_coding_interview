import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __vibeInterviewPrisma__: PrismaClient | undefined;
}

export const prismaSchemaRelativePath = "prisma/schema.prisma";

export const prisma =
  globalThis.__vibeInterviewPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__vibeInterviewPrisma__ = prisma;
}

export * from "@prisma/client";
