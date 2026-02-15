import "dotenv/config";

import { PrismaClient, type Prisma } from "@prisma/client";
import {
  encryptJsonValue,
  encryptNullableString,
  encryptString,
  isDataEncryptionEnabled,
  isEncryptedValue,
} from "../src/lib/security/data-protection";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

async function backfillSignInRecords(): Promise<number> {
  const rows = await prisma.signInRecord.findMany({
    where: {
      OR: [
        {
          visitor_phone: {
            not: { startsWith: "enc:v1:" },
          },
        },
        {
          AND: [
            { visitor_email: { not: null } },
            {
              visitor_email: {
                not: { startsWith: "enc:v1:" },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      visitor_phone: true,
      visitor_email: true,
    },
    take: BATCH_SIZE,
  });

  if (rows.length === 0) return 0;

  await Promise.all(
    rows.map((row) =>
      prisma.signInRecord.updateMany({
        where: { id: row.id },
        data: {
          visitor_phone: encryptString(row.visitor_phone),
          visitor_email: encryptNullableString(row.visitor_email),
        },
      }),
    ),
  );

  return rows.length;
}

async function backfillContractors(): Promise<number> {
  const rows = await prisma.contractor.findMany({
    where: {
      OR: [
        {
          AND: [
            { contact_email: { not: null } },
            {
              contact_email: {
                not: { startsWith: "enc:v1:" },
              },
            },
          ],
        },
        {
          AND: [
            { contact_phone: { not: null } },
            {
              contact_phone: {
                not: { startsWith: "enc:v1:" },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      contact_email: true,
      contact_phone: true,
    },
    take: BATCH_SIZE,
  });

  if (rows.length === 0) return 0;

  await Promise.all(
    rows.map((row) =>
      prisma.contractor.updateMany({
        where: { id: row.id },
        data: {
          contact_email: encryptNullableString(row.contact_email),
          contact_phone: encryptNullableString(row.contact_phone),
        },
      }),
    ),
  );

  return rows.length;
}

async function backfillInductionResponses(): Promise<number> {
  let cursorId: string | undefined;
  let updated = 0;

  while (true) {
    const rows = await prisma.inductionResponse.findMany({
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        answers: true,
      },
      take: BATCH_SIZE,
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      const answers = row.answers as Prisma.JsonValue;
      if (typeof answers === "string" && isEncryptedValue(answers)) {
        continue;
      }

      const encrypted = encryptJsonValue(answers);
      if (encrypted === answers) continue;

      await prisma.inductionResponse.updateMany({
        where: { id: row.id },
        data: {
          answers: encrypted as Prisma.InputJsonValue,
        },
      });
      updated += 1;
    }

    cursorId = rows[rows.length - 1]?.id;
  }

  return updated;
}

async function run() {
  if (!isDataEncryptionEnabled()) {
    console.error(
      "DATA_ENCRYPTION_KEY is not set. Aborting encryption backfill.",
    );
    process.exitCode = 1;
    return;
  }

  let signInUpdated = 0;
  let contractorUpdated = 0;

  // Keep processing until no plaintext string rows remain.
  while (true) {
    const changed = await backfillSignInRecords();
    signInUpdated += changed;
    if (changed === 0) break;
  }

  while (true) {
    const changed = await backfillContractors();
    contractorUpdated += changed;
    if (changed === 0) break;
  }

  const inductionUpdated = await backfillInductionResponses();

  console.error(
    `Encryption backfill complete. sign-ins=${signInUpdated}, contractors=${contractorUpdated}, inductionResponses=${inductionUpdated}`,
  );
}

run()
  .catch((error) => {
    console.error("Encryption backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
