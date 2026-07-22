CREATE INDEX `contact_options_user_id_idx` ON `contact_options` (`user_id`);--> statement-breakpoint
CREATE INDEX `contact_stages_user_id_idx` ON `contact_stages` (`user_id`);--> statement-breakpoint
CREATE INDEX `contacts_user_id_idx` ON `contacts` (`user_id`);--> statement-breakpoint
CREATE INDEX `contacts_next_follow_up_idx` ON `contacts` (`next_follow_up`);--> statement-breakpoint
CREATE INDEX `follow_up_logs_contact_id_idx` ON `follow_up_logs` (`contact_id`);--> statement-breakpoint
CREATE INDEX `prospects_user_id_idx` ON `prospects` (`user_id`);--> statement-breakpoint
CREATE INDEX `prospects_contact_id_idx` ON `prospects` (`contact_id`);--> statement-breakpoint
CREATE INDEX `rentals_equipment_id_idx` ON `rentals` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `schedule_changes_notified_at_idx` ON `schedule_changes` (`notified_at`);