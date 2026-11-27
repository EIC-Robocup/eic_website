/**
 * Smaller copies of the site photos in static/images, so phones don't download 1400 px
 * originals for 160 px thumbnails. Vercel Image Optimization only handles the Supabase media
 * bucket (vite.config.ts), so these are plain files that work the same everywhere.
 *
 *   node scripts/resize-images.ts           make missing copies and update src/lib/image.ts
 *   node scripts/resize-images.ts --force   remake every copy (after replacing a photo)
 *   node scripts/resize-images.ts --check   exit 1 when a copy or the list is missing
 *
 * For every photo in static/images/archive and static/images/people it writes
 * `<name>-480w.webp` and `<name>-960w.webp` (only sizes clearly smaller than the original),
 * then rewrites the STATIC_PHOTOS list in src/lib/image.ts, which srcset() and optimizedSrc()
 * read. The original stays the largest size. Run it after adding a photo there (with --force
 * after replacing one).
 *
 * Uses sharp, which @sveltejs/enhanced-img already installs.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const force = process.argv.includes('--force') && !check;
const FOLDERS = ['static/images/archive', 'static/images/people'];
const WIDTHS = [480, 960];
/** A copy is only worth it when the original is at least this much wider. */
const MIN_RATIO = 1.25;
const PHOTO = /\.(?:webp|jpe?g|png)$/i;
const COPY = /-\d+w\.webp$/i;
const imageTs = join(root, 'src/lib/image.ts');

type Sharp = (input: string) => {
	metadata(): Promise<{ width?: number }>;
	resize(options: { width: number }): { webp(options: { quality: number }): { toFile(path: string): Promise<unknown> } };
};

function loadSharp(): Sharp {
	const require = createRequire(join(root, 'package.json'));
	for (const from of ['sharp', join(root, 'node_modules/.pnpm/node_modules/sharp')]) {
		try {
			return require(from) as Sharp;
		} catch {
			// try the next place
		}
	}
	throw new Error('sharp is not installed. Run pnpm install first.');
}

const copyPath = (file: string, width: number) => file.replace(PHOTO, `-${width}w.webp`);

async function main() {
	const sharp = loadSharp();
	const list: Record<string, number[]> = {};
	let stale = 0;

	for (const folder of FOLDERS) {
		const dir = join(root, folder);
		if (!existsSync(dir)) continue;
		for (const name of readdirSync(dir).sort()) {
			if (!PHOTO.test(name) || COPY.test(name)) continue;
			const file = join(dir, name);
			const { width } = await sharp(file).metadata();
			if (!width) continue;
			const widths: number[] = [];
			for (const w of WIDTHS) {
				if (width < w * MIN_RATIO) continue;
				const out = copyPath(file, w);
				widths.push(w);
				if (existsSync(out) && !force) continue;
				stale += 1;
				if (check) {
					console.error(`Out of date: ${relative(root, out)}`);
					continue;
				}
				await sharp(file).resize({ width: w }).webp({ quality: 78 }).toFile(out);
				console.log(`wrote ${relative(root, out)}`);
			}
			if (widths.length) list[`/${relative(join(root, 'static'), file)}`] = [...widths, width];
		}
	}

	const body = Object.entries(list)
		.map(([path, widths]) => `\t'${path}': [${widths.join(', ')}],\n`)
		.join('');
	const source = readFileSync(imageTs, 'utf8');
	const block = /(\/\/ <static-photos>\n)[\s\S]*?(\t\/\/ <\/static-photos>)/;
	if (!block.test(source)) throw new Error('src/lib/image.ts has no // <static-photos> block.');
	const next = source.replace(block, (_m, start: string, end: string) => `${start}${body}${end}`);
	if (next !== source) {
		stale += 1;
		if (check) console.error('Out of date: the STATIC_PHOTOS list in src/lib/image.ts');
		else {
			writeFileSync(imageTs, next);
			console.log('updated src/lib/image.ts');
		}
	}

	if (check && stale) process.exitCode = 1;
	else console.log(check ? 'All photo copies are up to date.' : `Done. ${Object.keys(list).length} photos have copies.`);
}

await main();
