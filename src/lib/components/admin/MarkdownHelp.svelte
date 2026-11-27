<!--
	A compact cheat sheet of every Markdown feature posts support, with copyable examples. Put it
	in a Sheet or Dialog next to the post editor:

	<Sheet.Root bind:open={helpOpen}>
		<Sheet.Content side="right" class="w-full sm:max-w-md">
			<Sheet.Header><Sheet.Title>Markdown</Sheet.Title></Sheet.Header>
			<MarkdownHelp oninsert={(text) => insertAtCursor(text)} />
		</Sheet.Content>
	</Sheet.Root>

	With `oninsert`, each example also gets an Insert button. Copying shows a "Copied" toast.
-->
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { cn } from '#lib/utils.js';
	import { inputClass } from './styles.ts';

	type Props = {
		/** Called with an example's text when its Insert button is pressed. */
		oninsert?: (text: string) => void;
		class?: string;
	};

	let { oninsert, class: className }: Props = $props();

	type Entry = { name: string; example: string; note?: string; keywords?: string };
	type Group = { title: string; entries: Entry[] };

	const FENCE = '```';

	const GROUPS: Group[] = [
		{
			title: 'Text',
			entries: [
				{ name: 'Bold, italic, struck', example: '**bold**, _italic_, ~~struck~~' },
				{ name: 'Highlight', example: '==the part that matters==' },
				{ name: 'Inline code', example: 'Run `colcon build` first.' },
				{ name: 'Keyboard keys', example: 'Press <kbd>Ctrl</kbd> + <kbd>C</kbd>.' },
				{ name: 'Link', example: '[Read the paper](https://example.com)', note: 'Links to other sites open in a new tab.' },
				{
					name: 'Footnote',
					example: 'Walkie placed 6th of 24.[^1]\n\n[^1]: RoboCup@Home 2026, Incheon.',
					note: 'Listed under "Notes" at the end, with links back.'
				}
			]
		},
		{
			title: 'Headings',
			entries: [
				{
					name: 'Section and subsection',
					example: '## Five stages, one grasp\n\n### Why segmentation comes first',
					note: 'Sections and subsections make the table of contents. The post title is the only top heading.'
				}
			]
		},
		{
			title: 'Lists',
			entries: [
				{ name: 'Bullets', example: '- Gripper\n- Wrist camera\n- Base' },
				{ name: 'Numbered', example: '1. See\n2. Find\n3. Move' },
				{ name: 'Checklist', example: '- [x] Print the parts\n- [ ] Wire the motors', keywords: 'task todo' }
			]
		},
		{
			title: 'Quotes and callouts',
			entries: [
				{ name: 'Quote', example: '> Ask Walkie for a drink.' },
				{
					name: 'Callout',
					example: '> [!NOTE]\n> Useful context for the reader.',
					note: 'Also [!TIP], [!IMPORTANT], [!WARNING] and [!CAUTION]. Warning and caution are red.',
					keywords: 'alert admonition tip important'
				},
				{ name: 'Callout with a title', example: '> [!WARNING] The motors get hot\n> Let them cool before you touch the arm.' }
			]
		},
		{
			title: 'Images and media',
			entries: [
				{
					name: 'Figure',
					example: '![Walkie 2 lining up a bottle](https://example.com/photo.webp "An earlier grasp.")',
					note: 'The text in quotes becomes the numbered caption ("Fig. 02"). Paste or drop a photo into the editor to upload it; it is resized and compressed for you.',
					keywords: 'image photo picture caption upload'
				},
				{
					name: 'Gallery',
					example: '![Front](front.webp "Front") ![Side](side.webp "Side") ![Top](top.webp "Top")',
					note: 'Several images in one paragraph make a grid. Click any image to zoom.',
					keywords: 'grid lightbox'
				},
				{ name: 'Video file', example: '![The gripper closing](https://example.com/grasp.mp4 "First closed loop test.")', note: 'MP4 or WebM.' },
				{
					name: '3D model',
					example: '![Walkie 4 gripper](https://example.com/gripper.glb "Drag to turn it.")',
					note: 'GLB or glTF. Readers can turn and zoom it.',
					keywords: 'glb gltf cad model-viewer'
				},
				{
					name: 'YouTube or Vimeo',
					example: 'https://www.youtube.com/watch?v=VIDEO_ID&t=90',
					note: 'A link alone on its own line becomes a player (it loads only when clicked). t=90 starts at 1:30. For a title and caption: ![Walkie demo](https://youtu.be/VIDEO_ID "Caption").',
					keywords: 'embed video'
				},
				{ name: 'GitHub repository', example: 'https://github.com/owner/repo', note: 'Alone on its own line, it becomes a repository card.', keywords: 'embed card' }
			]
		},
		{
			title: 'Code',
			entries: [
				{
					name: 'Code block',
					example: `${FENCE}python\ndef grasp(target):\n    return plan(target)\n${FENCE}`,
					note: 'Highlighted for TypeScript, JavaScript, Python, C, C++, Rust, Go, Bash, YAML, TOML, XML (URDF, launch files), HTML, CSS, Svelte, JSON, SQL, CMake, Lua, Java, MATLAB, Dockerfile, Markdown and diff.',
					keywords: 'fence syntax highlight language'
				},
				{
					name: 'File name and marked lines',
					example: `${FENCE}ts title="grasp.ts" {2,4-5}\nimport { plan } from './planner';\nconst best = pick(grasps);\n\nexport function grasp() {\n  return plan(best);\n}\n${FENCE}`,
					note: 'Add showLineNumbers for line numbers.'
				},
				{ name: 'Diff', example: `${FENCE}diff\n- const speed = 0.5;\n+ const speed = 0.8;\n${FENCE}` }
			]
		},
		{
			title: 'Math',
			entries: [
				{
					name: 'Inline',
					example: 'Torque is $\\tau = r \\times F$.',
					note: 'Prices like "$5 and $10" stay text. Write \\$ for a dollar sign.',
					keywords: 'latex katex equation formula'
				},
				{ name: 'Display', example: '$$\n\\dot{q} = J(q)^{-1} \\dot{x}\n$$', keywords: 'latex katex equation block' }
			]
		},
		{
			title: 'Diagrams',
			entries: [
				{
					name: 'Mermaid',
					example: `${FENCE}mermaid\ngraph LR\n  A[See] --> B[Find] --> C[Grasp]\n${FENCE}`,
					note: 'Flowcharts, sequence diagrams, state machines and Gantt charts.',
					keywords: 'flowchart sequence chart'
				}
			]
		},
		{
			title: 'Tables and more',
			entries: [
				{
					name: 'Table',
					example: '| Joint | Torque | Speed |\n| :-- | --: | :-: |\n| Shoulder | 12.5 Nm | fast |\n| Elbow | 8 Nm | slow |',
					note: 'Colons align columns left, right or centre. Wide tables scroll sideways on phones.'
				},
				{ name: 'Collapsible', example: '<details>\n<summary>Show the full log</summary>\n\nThe log goes here.\n\n</details>', keywords: 'spoiler details' },
				{ name: 'Divider', example: '---', keywords: 'rule hr line' }
			]
		}
	];

	let query = $state('');
	let copiedKey: string | null = $state(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const uid = $props.id();

	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return GROUPS;
		return GROUPS.map((group) => ({
			...group,
			entries: group.entries.filter((e) =>
				[group.title, e.name, e.example, e.note ?? '', e.keywords ?? ''].join(' ').toLowerCase().includes(q)
			)
		})).filter((group) => group.entries.length);
	});

	async function copy(entry: Entry, key: string) {
		try {
			await navigator.clipboard.writeText(entry.example);
			copiedKey = key;
			clearTimeout(timer);
			timer = setTimeout(() => (copiedKey = null), 1500);
			toast.success('Copied');
		} catch {
			toast.error('Could not copy. Select the example and copy it by hand.');
		}
	}
</script>

<div class={cn('flex min-h-0 flex-col gap-4', className)}>
	<div class="relative">
		<SearchIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
		<Input
			bind:value={query}
			type="search"
			placeholder="Search, e.g. video, table, math"
			aria-label="Search the Markdown help"
			class="{inputClass} pl-9"
		/>
	</div>

	<div class="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
		{#each groups as group, g (group.title)}
			<section class="flex flex-col gap-3" aria-labelledby="{uid}-group-{g}">
				<h3 id="{uid}-group-{g}" class="text-label m-0 text-ink-muted">{group.title}</h3>
				<ul class="m-0 flex list-none flex-col gap-3 p-0">
					{#each group.entries as entry (entry.name)}
						{@const key = `${group.title}/${entry.name}`}
						<li class="flex flex-col gap-2 rounded-lg border border-line bg-surface-200 p-3">
							<div class="flex items-center gap-2">
								<span class="min-w-0 flex-1 text-sm font-medium text-ink">{entry.name}</span>
								{#if oninsert}
									<Button
										variant="ghost"
										size="sm"
										class="h-8 px-2 text-[13px] text-ink-muted hover:text-ink pointer-coarse:h-11"
										aria-label="Insert example: {entry.name}"
										onclick={() => oninsert?.(entry.example)}
									>
										<CornerDownLeftIcon aria-hidden="true" />
										Insert
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									class="h-8 px-2 text-[13px] text-ink-muted hover:text-ink pointer-coarse:h-11"
									aria-label="Copy example: {entry.name}"
									onclick={() => copy(entry, key)}
								>
									{#if copiedKey === key}
										<CheckIcon aria-hidden="true" />
										Copied
									{:else}
										<CopyIcon aria-hidden="true" />
										Copy
									{/if}
								</Button>
							</div>
							<pre
								class="m-0 rounded-sm border border-line bg-surface-000 px-3 py-2 font-mono text-[12.5px] leading-5 break-all whitespace-pre-wrap text-ink [font-variant-ligatures:none]">{entry.example}</pre>
							{#if entry.note}
								<p class="m-0 text-xs leading-[18px] text-ink-muted">{entry.note}</p>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="m-0 text-sm text-ink-muted">Nothing matches "{query}".</p>
		{/each}
	</div>
</div>
