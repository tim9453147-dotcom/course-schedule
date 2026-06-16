CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`color` text DEFAULT 'rose' NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
