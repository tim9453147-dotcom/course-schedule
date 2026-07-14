CREATE TABLE `notification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`target` text,
	`status` text NOT NULL,
	`error_message` text,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer DEFAULT 0 NOT NULL,
	`action` text NOT NULL,
	`classroom` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL,
	`notified_at` integer
);
