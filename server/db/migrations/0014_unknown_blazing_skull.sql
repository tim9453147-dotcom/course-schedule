CREATE TABLE `prospects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`contact_id` integer NOT NULL,
	`section` text NOT NULL,
	`date` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `friend_of` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `dev_partner` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `info` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `level` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `status` text;