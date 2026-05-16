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
