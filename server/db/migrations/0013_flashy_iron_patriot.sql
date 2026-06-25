ALTER TABLE `courses` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `ex_dates` text DEFAULT '[]' NOT NULL;