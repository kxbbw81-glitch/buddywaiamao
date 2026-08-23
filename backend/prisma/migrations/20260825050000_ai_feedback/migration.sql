CREATE TABLE "AiFeedback" (
  "id" TEXT NOT NULL,
  "aiTaskId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "note" TEXT,
  "correctedOutput" JSONB,
  "adoptionTarget" TEXT,
  "adoptionTargetId" TEXT,
  "createsFormalWrite" BOOLEAN NOT NULL DEFAULT false,
  "confirmedHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiFeedback_aiTaskId_createdAt_idx" ON "AiFeedback"("aiTaskId", "createdAt");
CREATE INDEX "AiFeedback_action_status_createdAt_idx" ON "AiFeedback"("action", "status", "createdAt");
CREATE INDEX "AiFeedback_createdById_createdAt_idx" ON "AiFeedback"("createdById", "createdAt");

ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_aiTaskId_fkey" FOREIGN KEY ("aiTaskId") REFERENCES "AiTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
