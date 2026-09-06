import "dotenv/config";
import { prisma } from "../src/db/prisma";
import { ingestOne } from "../src/jobs/ingestOne";

const USER_ID = "3c57208c-0cad-41f0-8a96-1369f2f94a04";
const LIMIT = 15;

async function main() {
  const pending = await prisma.ingestedEmail.findMany({
    where: { userId: USER_ID, status: "pending_parse" },
    select: { gmailMessageId: true, subject: true, fromAddress: true },
    take: LIMIT,
    orderBy: { receivedAt: "asc" },
  });

  console.log(`Testing ${pending.length} of the pending backlog\n`);

  const summary = { created: 0, duplicate: 0, unparseable: 0, failed: 0 };
  for (const { gmailMessageId, subject, fromAddress } of pending) {
    try {
      const result = await ingestOne(USER_ID, gmailMessageId);
      summary[result]++;
      console.log(`[${result}] ${fromAddress} — "${subject}"`);
    } catch (error) {
      summary.failed++;
      console.log(`[failed] ${fromAddress} — "${subject}" :: ${(error as Error).message}`);
    }
  }

  console.log("\nSummary:", summary);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
