CREATE TABLE `gathering_finances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gathering_id` integer NOT NULL,
	`headcount` integer,
	`fee` integer,
	`expense` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gathering_id`) REFERENCES `gatherings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gathering_finances_gathering_id_unique` ON `gathering_finances` (`gathering_id`);--> statement-breakpoint
CREATE TABLE `gatherings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`map_url` text,
	`cook` text,
	`assistant` text,
	`shopper` text,
	`process` text,
	`attendees` text,
	`recipe_id` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ingredients` text,
	`steps` text,
	`note` text,
	`created_at` integer NOT NULL
);
