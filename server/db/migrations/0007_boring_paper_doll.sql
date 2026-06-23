CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`pages` text DEFAULT '[]' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`approved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);