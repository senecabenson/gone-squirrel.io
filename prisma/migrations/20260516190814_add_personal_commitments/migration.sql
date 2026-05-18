-- CreateTable
CREATE TABLE "PersonalCommitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "rrule" TEXT NOT NULL,
    "preferredHour" INTEGER,
    "timesPerWeek" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastMaterializedThrough" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentEvent" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "googleEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalCommitment_userId_idx" ON "PersonalCommitment"("userId");

-- CreateIndex
CREATE INDEX "PersonalCommitment_active_idx" ON "PersonalCommitment"("active");

-- CreateIndex
CREATE INDEX "CommitmentEvent_commitmentId_idx" ON "CommitmentEvent"("commitmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitmentEvent_commitmentId_scheduledDate_key" ON "CommitmentEvent"("commitmentId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "PersonalCommitment" ADD CONSTRAINT "PersonalCommitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitmentEvent" ADD CONSTRAINT "CommitmentEvent_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "PersonalCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
