-- MOE Result Bot — broadcast recall + per-user message tracking
-- Run once in phpMyAdmin against your bot database (existing deployments).

CREATE TABLE IF NOT EXISTS `BroadcastMessage` (
  `broadcastId` VARCHAR(30) NOT NULL,
  `telegramId` BIGINT NOT NULL,
  `messageId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`broadcastId`, `telegramId`),
  KEY `BroadcastMessage_broadcastId_idx` (`broadcastId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `Broadcast`
  ADD COLUMN `recalledAt` DATETIME(3) NULL AFTER `total`,
  ADD COLUMN `recalled` INT NOT NULL DEFAULT 0 AFTER `recalledAt`,
  ADD COLUMN `recallFailed` INT NOT NULL DEFAULT 0 AFTER `recalled`;
