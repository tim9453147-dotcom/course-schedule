CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`step_break` integer DEFAULT false NOT NULL,
	`step_2` integer DEFAULT false NOT NULL,
	`step_336` integer DEFAULT false NOT NULL,
	`step_joined` integer DEFAULT false NOT NULL,
	`step_28` integer DEFAULT false NOT NULL,
	`contact` text,
	`follow_up_freq` text,
	`last_follow_up` text,
	`next_follow_up` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `follow_up_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`date` text NOT NULL,
	`content` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
