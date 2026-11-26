-- Public bucket for images and files uploaded through the admin panel.
-- Anyone can read files by URL; only the server (with the secret key) uploads or deletes,
-- so no storage policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'media',
	'media',
	true,
	10485760,
	array[
		'image/png',
		'image/jpeg',
		'image/webp',
		'image/gif',
		'image/avif',
		'image/svg+xml',
		'application/pdf'
	]
)
on conflict (id) do update
set public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;
