/**
 * Idempotent e2e fixture: ensures the test@example.com user exists with
 * credentials auth, mirroring src/app/api/auth/register/route.ts exactly.
 * Run: npx tsx scripts/seed-e2e.ts
 */
import { hash } from "bcrypt";

import { prisma } from "../src/lib/prisma";

const EMAIL = "test@example.com";
const PASSWORD = "testpassword123";

async function main() {
  // Safety: this seeds a fixed weak-credential account. Never let it run
  // against a non-local database (staging/prod).
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
    console.error(
      "seed-e2e refuses to run: DATABASE_URL is not local " +
        "(expected localhost/127.0.0.1). Set a local DB and retry."
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("e2e user already exists:", existing.id);
    return;
  }
  const hashedPassword = await hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Test User",
      accounts: {
        create: {
          type: "credentials",
          provider: "credentials",
          providerAccountId: EMAIL,
          id_token: hashedPassword,
        },
      },
      userSettings: { create: { theme: "system", timeZone: "UTC" } },
    },
  });
  console.log("created e2e user:", user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
