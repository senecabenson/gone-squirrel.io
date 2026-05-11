-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "chunkMax" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "chunkMin" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "TaskChunk" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "googleEventId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskChunk_taskId_idx" ON "TaskChunk"("taskId");

-- CreateIndex
CREATE INDEX "TaskChunk_scheduledStart_idx" ON "TaskChunk"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "TaskChunk_taskId_chunkIndex_key" ON "TaskChunk"("taskId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "TaskChunk" ADD CONSTRAINT "TaskChunk_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
