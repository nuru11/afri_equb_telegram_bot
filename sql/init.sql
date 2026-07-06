-- MOE Result Bot — MySQL schema
-- Run once in phpMyAdmin against your bot database.

CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(30) NOT NULL,
  `telegramId` BIGINT NOT NULL,
  `username` VARCHAR(255) NULL,
  `firstName` VARCHAR(255) NULL,
  `isBlocked` TINYINT(1) NOT NULL DEFAULT 0,
  `remedialChannelVerified` TINYINT(1) NOT NULL DEFAULT 0,
  `entranceChannelVerified` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_telegramId_key` (`telegramId`),
  KEY `User_isBlocked_idx` (`isBlocked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Settings` (
  `id` VARCHAR(30) NOT NULL DEFAULT 'default',
  `remedialReleased` TINYINT(1) NOT NULL DEFAULT 0,
  `entranceReleased` TINYINT(1) NOT NULL DEFAULT 0,
  `remedialChannelLink` TEXT NOT NULL,
  `entranceChannelLink` TEXT NOT NULL,
  `remedialChannelChatId` VARCHAR(255) NOT NULL DEFAULT '',
  `entranceChannelChatId` VARCHAR(255) NOT NULL DEFAULT '',
  `remedialUrl` TEXT NOT NULL,
  `entranceUrl` TEXT NOT NULL,
  `preReleaseMessage` TEXT NOT NULL,
  `postActionMessage` TEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Analytics` (
  `id` VARCHAR(30) NOT NULL DEFAULT 'default',
  `remedialClicks` INT NOT NULL DEFAULT 0,
  `entranceClicks` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Broadcast` (
  `id` VARCHAR(30) NOT NULL,
  `content` TEXT NOT NULL,
  `photoUrl` TEXT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `sent` INT NOT NULL DEFAULT 0,
  `failed` INT NOT NULL DEFAULT 0,
  `total` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Admin` (
  `id` VARCHAR(30) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Admin_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `Settings` (
  `id`,
  `remedialReleased`,
  `entranceReleased`,
  `remedialChannelLink`,
  `entranceChannelLink`,
  `remedialChannelChatId`,
  `entranceChannelChatId`,
  `remedialUrl`,
  `entranceUrl`,
  `preReleaseMessage`,
  `postActionMessage`
) VALUES (
  'default',
  0,
  0,
  '',
  '',
  '',
  '',
  '',
  '',
  'Your result will be released soon.',
  'Thank you for joining our channel! You can now check your result using the link below.'
) ON DUPLICATE KEY UPDATE `id` = `id`;

INSERT INTO `Analytics` (`id`, `remedialClicks`, `entranceClicks`)
VALUES ('default', 0, 0)
ON DUPLICATE KEY UPDATE `id` = `id`;
