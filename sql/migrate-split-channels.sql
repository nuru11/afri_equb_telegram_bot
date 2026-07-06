-- MOE Result Bot — split shared channel into remedial + entrance channels
-- Run once in phpMyAdmin against your bot database (existing deployments).

ALTER TABLE `Settings`
  ADD COLUMN `remedialChannelLink` TEXT NOT NULL DEFAULT '' AFTER `entranceReleased`,
  ADD COLUMN `entranceChannelLink` TEXT NOT NULL DEFAULT '' AFTER `remedialChannelLink`,
  ADD COLUMN `remedialChannelChatId` VARCHAR(255) NOT NULL DEFAULT '' AFTER `entranceChannelLink`,
  ADD COLUMN `entranceChannelChatId` VARCHAR(255) NOT NULL DEFAULT '' AFTER `remedialChannelChatId`;

UPDATE `Settings` SET
  `remedialChannelLink` = `channelLink`,
  `entranceChannelLink` = `channelLink`,
  `remedialChannelChatId` = `channelChatId`,
  `entranceChannelChatId` = `channelChatId`
WHERE `id` = 'default';

ALTER TABLE `User`
  ADD COLUMN `remedialChannelVerified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `isBlocked`,
  ADD COLUMN `entranceChannelVerified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `remedialChannelVerified`;

UPDATE `User` SET
  `remedialChannelVerified` = `channelVerified`,
  `entranceChannelVerified` = `channelVerified`;

ALTER TABLE `Settings`
  DROP COLUMN `channelLink`,
  DROP COLUMN `channelChatId`;

ALTER TABLE `User`
  DROP COLUMN `channelVerified`;
