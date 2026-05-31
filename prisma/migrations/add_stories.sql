-- Add Story and StoryView tables for Instagram-style Stories feature

CREATE TABLE IF NOT EXISTS "Story" (
    "id"          SERIAL PRIMARY KEY,
    "userId"      INTEGER NOT NULL,
    "mediaUrl"    TEXT NOT NULL,
    "mediaType"   TEXT NOT NULL DEFAULT 'image',
    "caption"     TEXT,
    "textOverlay" JSONB,
    "viewCount"   INTEGER NOT NULL DEFAULT 0,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "StoryView" (
    "id"       SERIAL PRIMARY KEY,
    "storyId"  INTEGER NOT NULL,
    "viewerId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Story_userId_expiresAt_idx" ON "Story"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");
CREATE INDEX IF NOT EXISTS "StoryView_viewerId_idx" ON "StoryView"("viewerId");
