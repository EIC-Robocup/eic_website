-- The media bucket also takes PDFs up to 20 MB, MP4/WebM videos up to 50 MB and glTF 3D models
-- (.glb, .gltf) up to 25 MB, besides images up to 10 MB. Uploads go straight from the browser
-- with a signed upload URL, so the bucket limit is the largest of these (50 MB); the per-type
-- limits are checked by the app (src/lib/server/storage.ts) before signing and after upload.
-- Still no SVG: it could run scripts on the storage origin. Matches [storage.buckets.media]
-- in supabase/config.toml.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'media',
	'media',
	true,
	52428800,
	array[
		'image/png',
		'image/jpeg',
		'image/webp',
		'image/gif',
		'image/avif',
		'application/pdf',
		'video/mp4',
		'video/webm',
		'model/gltf-binary',
		'model/gltf+json'
	]
)
on conflict (id) do update
set public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;
