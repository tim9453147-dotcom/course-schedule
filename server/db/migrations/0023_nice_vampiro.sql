ALTER TABLE `users` ADD `access_email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_access_email_unique` ON `users` (`access_email`);