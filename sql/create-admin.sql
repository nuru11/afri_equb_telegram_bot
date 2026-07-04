-- Create admin user for dashboard login
-- Default: admin@example.com / changeme

INSERT INTO `Admin` (`id`, `email`, `passwordHash`, `createdAt`)
VALUES (
  'admin1',
  'admin@example.com',
  '$2b$12$Hk0tOP1QFh8onN3DX/HQS.TYKNwaKQ3bc6GCLXV1DbfOzWS4Wdt22',
  NOW(3)
)
ON DUPLICATE KEY UPDATE
  `passwordHash` = VALUES(`passwordHash`),
  `email` = VALUES(`email`);
