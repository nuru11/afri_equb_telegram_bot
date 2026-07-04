-- MOE Result Bot — Manual maintenance queries
-- Run in phpMyAdmin against your bot database.
-- Initial setup: use init.sql first.

-- ---------------------------------------------------------------------------
-- Toggle result release (1 = released, 0 = not released)
-- ---------------------------------------------------------------------------
UPDATE `Settings`
SET `remedialReleased` = 1, `entranceReleased` = 0
WHERE `id` = 'default';

-- ---------------------------------------------------------------------------
-- Update channel and result URLs
-- ---------------------------------------------------------------------------
UPDATE `Settings`
SET
  `channelLink` = 'https://t.me/yourchannel',
  `channelChatId` = '@yourchannel',
  `remedialUrl` = 'https://example.com/remedial',
  `entranceUrl` = 'https://example.com/entrance'
WHERE `id` = 'default';

-- ---------------------------------------------------------------------------
-- Update custom messages
-- ---------------------------------------------------------------------------
UPDATE `Settings`
SET
  `preReleaseMessage` = 'Your result will be released soon.',
  `postActionMessage` = 'Thank you for joining! Check your result below.'
WHERE `id` = 'default';

-- ---------------------------------------------------------------------------
-- View user stats
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS total_users FROM `User`;
SELECT COUNT(*) AS active_users FROM `User` WHERE `isBlocked` = 0;
SELECT COUNT(*) AS blocked_users FROM `User` WHERE `isBlocked` = 1;
SELECT * FROM `Analytics` WHERE `id` = 'default';

-- ---------------------------------------------------------------------------
-- Reset click counters
-- ---------------------------------------------------------------------------
UPDATE `Analytics`
SET `remedialClicks` = 0, `entranceClicks` = 0
WHERE `id` = 'default';

-- ---------------------------------------------------------------------------
-- Create or update admin user (manual)
-- Generate a bcrypt hash (e.g. online bcrypt generator or node -e "...")
-- Then replace email and passwordHash below.
-- ---------------------------------------------------------------------------
INSERT INTO `Admin` (`id`, `email`, `passwordHash`, `createdAt`)
VALUES (
  'admin1',
  'admin@example.com',
  '$2b$12$PASTE_BCRYPT_HASH_HERE',
  NOW(3)
)
ON DUPLICATE KEY UPDATE
  `passwordHash` = VALUES(`passwordHash`),
  `email` = VALUES(`email`);

-- ---------------------------------------------------------------------------
-- Verify tables exist
-- ---------------------------------------------------------------------------
SHOW TABLES;
