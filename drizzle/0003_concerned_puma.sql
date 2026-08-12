CREATE TABLE `place_confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`place_name` text NOT NULL,
	`official_url` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`confirmed_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_place_confirmations_activity_latest` ON `place_confirmations` (`activity_id`,`confirmed_at`);--> statement-breakpoint
PRAGMA optimize;
