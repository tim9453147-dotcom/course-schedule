CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`classroom` text DEFAULT '中壢' NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`total_qty` integer DEFAULT 1 NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`borrower` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`borrow_date` text NOT NULL,
	`due_date` text,
	`return_date` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
