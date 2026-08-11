CREATE TABLE `itinerary_versions` (
	`trip_id` text NOT NULL,
	`version` integer NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`snapshot_json` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`source_version` integer,
	`summary` text NOT NULL,
	`author_id` text,
	`author_name` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`trip_id`, `version`)
);
