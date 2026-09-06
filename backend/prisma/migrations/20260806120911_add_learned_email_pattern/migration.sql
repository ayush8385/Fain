-- CreateTable
CREATE TABLE "LearnedEmailPattern" (
    "id" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "regex" TEXT NOT NULL,
    "flags" TEXT NOT NULL DEFAULT 'is',
    "groupOrder" JSONB NOT NULL,
    "fixedCurrency" TEXT,
    "fixedDirection" TEXT,
    "sampleSubject" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 1,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnedEmailPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnedEmailPattern_senderAddress_regex_key" ON "LearnedEmailPattern"("senderAddress", "regex");
