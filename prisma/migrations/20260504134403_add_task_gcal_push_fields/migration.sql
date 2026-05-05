-- AlterTable
ALTER TABLE "IntegrationSettings" ADD COLUMN     "taskCalendarId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "googleEventId" TEXT;
