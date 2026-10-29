-- CreateEnum
CREATE TYPE "Series" AS ENUM ('F1', 'F2', 'MOTOGP');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PRACTICE', 'QUALIFYING', 'SPRINT', 'RACE');

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "driverNumber" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "series" "Series" NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constructors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" "Series" NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colorHex" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "lengthKm" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "series" "Series" NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "circuitId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "rpm" INTEGER NOT NULL,
    "gear" INTEGER NOT NULL,
    "throttle" DOUBLE PRECISION NOT NULL,
    "brake" DOUBLE PRECISION NOT NULL,
    "drs" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_logs" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "trackTemp" DOUBLE PRECISION NOT NULL,
    "airTemp" DOUBLE PRECISION NOT NULL,
    "rainProbability" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "series" "Series" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_code_key" ON "drivers"("code");

-- CreateIndex
CREATE INDEX "drivers_series_points_idx" ON "drivers"("series", "points" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "constructors_name_key" ON "constructors"("name");

-- CreateIndex
CREATE INDEX "constructors_series_points_idx" ON "constructors"("series", "points" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "circuits_name_country_key" ON "circuits"("name", "country");

-- CreateIndex
CREATE INDEX "sessions_series_startTime_idx" ON "sessions"("series", "startTime" DESC);

-- CreateIndex
CREATE INDEX "sessions_isActive_idx" ON "sessions"("isActive");

-- CreateIndex
CREATE INDEX "telemetry_sessionId_driverId_timestamp_idx" ON "telemetry"("sessionId", "driverId", "timestamp");

-- CreateIndex
CREATE INDEX "weather_logs_sessionId_recordedAt_idx" ON "weather_logs"("sessionId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "news_items_series_publishedAt_idx" ON "news_items"("series", "publishedAt" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry" ADD CONSTRAINT "telemetry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry" ADD CONSTRAINT "telemetry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_logs" ADD CONSTRAINT "weather_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
