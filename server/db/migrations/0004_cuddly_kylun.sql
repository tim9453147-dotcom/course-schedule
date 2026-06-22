ALTER TABLE `courses` ADD `kind` text DEFAULT 'course' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `kind` text DEFAULT 'activity' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `teacher` text;