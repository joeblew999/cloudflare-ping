CREATE TABLE `datacentres` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `maps` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`places` integer NOT NULL,
	`countries` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sightings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`map_id` text NOT NULL,
	`measurement` text NOT NULL,
	`country` text NOT NULL,
	`city` text NOT NULL,
	`asn` integer NOT NULL,
	`network` text NOT NULL,
	`status` text NOT NULL,
	`colo` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sightings_map_id` ON `sightings` (`map_id`);