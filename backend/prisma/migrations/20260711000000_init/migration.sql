-- CreateEnum
CREATE TYPE "ScanMode" AS ENUM ('single', 'batch');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ScanResultStatus" AS ENUM ('success', 'uncertain', 'rejected');

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "size_ha" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT,
    "mode" "ScanMode" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'processing',
    "total_images" INTEGER NOT NULL,
    "diagnosed_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "uncertain_count" INTEGER NOT NULL DEFAULT 0,
    "dominant_finding" TEXT,
    "by_disease" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ScanResultStatus" NOT NULL,
    "disease_name" TEXT,
    "predicted_class" TEXT,
    "cause" TEXT,
    "symptoms" TEXT,
    "treatment" TEXT,
    "prevention" TEXT,
    "recommendations" JSONB,
    "message" TEXT,
    "observed" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scans_farm_id_idx" ON "scans"("farm_id");

-- CreateIndex
CREATE INDEX "scans_created_at_idx" ON "scans"("created_at");

-- CreateIndex
CREATE INDEX "scan_results_scan_id_idx" ON "scan_results"("scan_id");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
