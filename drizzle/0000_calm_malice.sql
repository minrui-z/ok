CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`day_id` text,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notes_scope_day_updated` ON `notes` (`scope`,`day_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_author` ON `notes` (`author_id`);--> statement-breakpoint
CREATE TABLE `poll_options` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_poll_options_position` ON `poll_options` (`poll_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_poll_options_poll` ON `poll_options` (`poll_id`);--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`poll_id` text NOT NULL,
	`option_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`participant_name` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `participant_id`, `option_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `poll_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_poll_votes_poll_option` ON `poll_votes` (`poll_id`,`option_id`);--> statement-breakpoint
CREATE INDEX `idx_poll_votes_participant` ON `poll_votes` (`participant_id`);--> statement-breakpoint
CREATE TABLE `polls` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`type` text NOT NULL,
	`scope` text NOT NULL,
	`day_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_polls_scope_day_updated` ON `polls` (`scope`,`day_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_polls_author` ON `polls` (`author_id`);--> statement-breakpoint
CREATE TABLE `unlock_attempts` (
	`source_hash` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`failures` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
