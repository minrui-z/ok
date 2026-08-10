CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`day_id` text,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`paid_by` text NOT NULL,
	`participants_json` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_day_updated` ON `expenses` (`day_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_expenses_author` ON `expenses` (`author_id`);