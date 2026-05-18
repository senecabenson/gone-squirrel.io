-- AlterTable
ALTER TABLE "AutoScheduleSettings" ADD COLUMN     "blockTypeMap" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "noEligibleBlockPolicy" TEXT NOT NULL DEFAULT 'schedule_nothing',
ADD COLUMN     "skipReflowBlockType" TEXT NOT NULL DEFAULT 'light',
ADD COLUMN     "taskBlocksFeedId" TEXT;
