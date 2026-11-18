-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('IN_PROGRESS', 'CAPSTONE_BLUEPRINT', 'CAPSTONE_CODING', 'LIVE_DEFENSE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DefenseSessionStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningTrack" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "framework" TEXT,
    "targetFocus" TEXT NOT NULL,
    "status" "TrackStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumModule" (
    "id" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "coreConcepts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cleanCodeRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "practicePrompts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CurriculumModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleAssessment" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "examPayload" JSONB NOT NULL,
    "userSolution" JSONB,
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "aiFeedback" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapstoneProject" (
    "id" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "isUserProposed" BOOLEAN NOT NULL DEFAULT false,
    "blueprintPayload" JSONB,
    "blueprintApproved" BOOLEAN NOT NULL DEFAULT false,
    "blueprintFeedback" TEXT,
    "sourceFiles" JSONB,
    "pasteAnomalyCount" INTEGER NOT NULL DEFAULT 0,
    "logicScore" DOUBLE PRECISION,
    "cleanCodeScore" DOUBLE PRECISION,
    "defenseScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "finalReview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapstoneProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefenseSession" (
    "id" UUID NOT NULL,
    "capstoneId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "DefenseSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefenseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefenseChallenge" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "challengeIndex" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "targetFilePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedBehavior" TEXT NOT NULL,
    "submittedFiles" JSONB,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "aiEvaluation" TEXT,

    CONSTRAINT "DefenseChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" UUID NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "framework" TEXT,
    "projectTitle" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LearningTrack_userId_status_idx" ON "LearningTrack"("userId", "status");

-- CreateIndex
CREATE INDEX "LearningTrack_userId_createdAt_idx" ON "LearningTrack"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CurriculumModule_trackId_idx" ON "CurriculumModule"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumModule_trackId_orderIndex_key" ON "CurriculumModule"("trackId", "orderIndex");

-- CreateIndex
CREATE INDEX "ModuleAssessment_moduleId_idx" ON "ModuleAssessment"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleAssessment_moduleId_attemptNumber_key" ON "ModuleAssessment"("moduleId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CapstoneProject_trackId_key" ON "CapstoneProject"("trackId");

-- CreateIndex
CREATE INDEX "DefenseSession_capstoneId_status_idx" ON "DefenseSession"("capstoneId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DefenseSession_capstoneId_attemptNumber_key" ON "DefenseSession"("capstoneId", "attemptNumber");

-- CreateIndex
CREATE INDEX "DefenseChallenge_sessionId_idx" ON "DefenseChallenge"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DefenseChallenge_sessionId_challengeIndex_key" ON "DefenseChallenge"("sessionId", "challengeIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_trackId_key" ON "Certificate"("trackId");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- AddForeignKey
ALTER TABLE "LearningTrack" ADD CONSTRAINT "LearningTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumModule" ADD CONSTRAINT "CurriculumModule_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "LearningTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAssessment" ADD CONSTRAINT "ModuleAssessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneProject" ADD CONSTRAINT "CapstoneProject_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "LearningTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefenseSession" ADD CONSTRAINT "DefenseSession_capstoneId_fkey" FOREIGN KEY ("capstoneId") REFERENCES "CapstoneProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefenseChallenge" ADD CONSTRAINT "DefenseChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DefenseSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "LearningTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
