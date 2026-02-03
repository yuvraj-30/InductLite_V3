/* eslint-disable no-console, @typescript-eslint/no-var-requires */
const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

async function main() {
  const prisma = new PrismaClient();

  try {
    const hash = await argon2.hash("Admin123!", {
      type: 2, // argon2id
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await prisma.user.update({
      where: { email: "admin@buildright.co.nz" },
      data: {
        password_hash: hash,
        failed_logins: 0,
        locked_until: null,
      },
    });

    console.log("✅ Password reset and account unlocked:", user.email);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
