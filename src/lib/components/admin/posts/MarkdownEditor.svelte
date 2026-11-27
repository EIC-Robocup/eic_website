<!--
	The post body editor: a plain textarea that knows Markdown, with no editor library.

	- Write / Preview / Split. The preview is rendered by the server (POST /admin/api/preview,
	  the renderer the public post page uses) and shown with PostBody, so it looks exactly like
	  the published post. Split shows both side by side on wide screens and keeps them scrolled
	  to the same place.
	- Paste photos from the clipboard, or drop files anywhere on the editor: each gets an
	  "Uploading…" placeholder at the cursor, goes up with uploadFile() (photos are compressed
	  first) and the placeholder becomes ![alt](url). Several files at once land in one
	  paragraph, which the post shows as a gallery. Videos and 3D models get figures, PDFs links.
	- Paste a link over selected text to make it a link. Paste cells from a spreadsheet to get
	  a Markdown table. A YouTube or Vimeo link pasted on an empty line becomes a player.
	- Toolbar (role="toolbar", arrow keys move between tools) and shortcuts: Ctrl/Cmd+B, I, K,
	  E (code), Shift+Ctrl+7/8/9 lists, Tab/Shift+Tab nest list items, Enter continues lists,
	  Ctrl/Cmd+Enter toggles the preview. Edits go through execCommand('insertText'), so undo
	  (Ctrl+Z) keeps working.
	- Fullscreen focus mode (Esc leaves it) and a Markdown help sheet.

	The textarea submits as `name`. Ctrl/Cmd+S is left to the page (it saves the whole form).

	<MarkdownEditor name="body" bind:value={body} bind:uploading figureStart={2}
		savedLabel="Saved 2 min ago" />

	Posts pass figureStart={2}: the cover slot is Fig. 01 whether or not it has a photo.
-->
<script lang="ts" module>
	export type EditorMode = 'write' | 'preview' | 'split';
</script>

<script lang="ts">
	import { onDestroy, tick, untrack, type Component } from 'svelte';
	import { toast } from 'svelte-sonner';
	import BoldIcon from '@lucide/svelte/icons/letter-b';
	import CircleQuestionIcon from '@lucide/svelte/icons/circle-question-mark';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import CodeIcon from '@lucide/svelte/icons/code';
	import Columns2Icon from '@lucide/svelte/icons/columns-2';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import HeadingIcon from '@lucide/svelte/icons/letter-h';
	import ImageIcon from '@lucide/svelte/icons/image';
	import InfoIcon from '@lucide/svelte/icons/info';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import LightbulbIcon from '@lucide/svelte/icons/lightbulb';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import ListTodoIcon from '@lucide/svelte/icons/list-todo';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import MessageSquareImportantIcon from '@lucide/svelte/icons/message-square-exclamation-point';
	import MessageSquareTextIcon from '@lucide/svelte/icons/message-square-text';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import OctagonAlertIcon from '@lucide/svelte/icons/octagon-exclamation-point';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/circle-play';
	import QuoteIcon from '@lucide/svelte/icons/text-quote';
	import SeparatorIcon from '@lucide/svelte/icons/separator-horizontal';
	import SigmaIcon from '@lucide/svelte/icons/sigma';
	import SquareCodeIcon from '@lucide/svelte/icons/square-code';
	import TableIcon from '@lucide/svelte/icons/table';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-exclamation-point';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import PostBody from '#lib/components/site/PostBody.svelte';
	import MarkdownHelp from '../MarkdownHelp.svelte';
	import { acceptAttribute, checkFile, fileType, formatBytes, savings, uploadFile, type UploadFolder, type UploadedMedia } from '../upload.ts';
	import EmbedDialog from './EmbedDialog.svelte';
	import * as md from './markdown-commands.ts';
	import { LIMITS, byteLength, countMarkdownWords, readingMinutes } from './post-fields.ts';
	import ToolButton from './ToolButton.svelte';

	type Props = {
		/** The Markdown. Bindable. */
		value?: string;
		/** Form field name of the textarea. */
		name?: string;
		id?: string;
		/** Accessible name of the textarea (visually hidden). */
		label?: string;
		placeholder?: string;
		/** Error from the server, shown under the editor. */
		error?: string | null;
		/** Number of the first figure in the preview (2 when the post has a cover). */
		figureStart?: number;
		/** Upload folder in the media bucket. */
		folder?: UploadFolder;
		/** Write, Preview or Split. Bindable. */
		mode?: EditorMode;
		/** True while files upload. Bindable, e.g. to hold back saving. */
		uploading?: boolean;
		/** Right end of the status line, e.g. "Saved 2 min ago". */
		savedLabel?: string;
		/** Upload photos without re-encoding them. */
		keepOriginal?: boolean;
		class?: string;
	};

	let {
		value = $bindable(''),
		name,
		id,
		label = 'Post body in Markdown',
		placeholder = 'Write in Markdown. Paste or drop photos, videos and PDFs to upload them.',
		error = null,
		figureStart = 1,
		folder = 'posts',
		mode = $bindable('write'),
		uploading = $bindable(false),
		savedLabel = '',
		keepOriginal = false,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const textareaId = $derived(id ?? `markdown-${uid}`);
	const hintId = $derived(`${textareaId}-hint`);
	const errorId = $derived(`${textareaId}-error`);

	let textarea: HTMLTextAreaElement | null = $state(null);
	let previewEl: HTMLDivElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let toolbar: HTMLDivElement | undefined = $state();

	let fullscreen = $state(false);
	let helpOpen = $state(false);
	let embedOpen = $state(false);
	let embedInitial = $state('');
	let announcement = $state('');
	let hasFocused = false;

	/* ---------------------------------------------------------------------------------------- */
	/* Platform details                                                                          */
	/* ---------------------------------------------------------------------------------------- */

	let mac = $state(false);
	$effect(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	});
	const mod = $derived(mac ? '⌘' : 'Ctrl');
	const keys = (...k: string[]) => [mod, ...k];
	const aria = (key: string, shift = false) => `${shift ? 'Shift+' : ''}Control+${key} ${shift ? 'Shift+' : ''}Meta+${key}`;

	// Remember the preferred mode on this device.
	const MODE_KEY = 'eic:markdown-editor-mode';
	$effect(() => {
		untrack(() => {
			try {
				const saved = localStorage.getItem(MODE_KEY);
				if (saved === 'write' || saved === 'preview' || saved === 'split') mode = saved;
			} catch {
				// Storage blocked: start in Write.
			}
		});
	});

	function setMode(next: EditorMode) {
		mode = next;
		try {
			localStorage.setItem(MODE_KEY, next);
		} catch {
			// ignore
		}
		announce(next === 'write' ? 'Write mode' : next === 'preview' ? 'Preview mode' : 'Split view: editor and preview side by side');
	}

	async function togglePreview() {
		const showing = mode === 'preview';
		setMode(showing ? 'write' : 'preview');
		await tick();
		if (showing) textarea?.focus();
		else previewEl?.focus();
	}

	async function announce(text: string) {
		announcement = '';
		await tick();
		announcement = text;
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Applying edits                                                                            */
	/* ---------------------------------------------------------------------------------------- */

	function selection(): md.Range {
		if (!textarea) return { start: value.length, end: value.length };
		if (!hasFocused && document.activeElement !== textarea) return { start: value.length, end: value.length };
		return { start: textarea.selectionStart, end: textarea.selectionEnd };
	}

	/** Replace text the way typing does, so the browser's undo history keeps it. */
	function replaceText(ta: HTMLTextAreaElement, from: number, to: number, insert: string) {
		const before = ta.value;
		const expected = before.slice(0, from) + insert + before.slice(to);
		ta.setSelectionRange(from, to);
		let done = false;
		try {
			done = document.execCommand('insertText', false, insert);
		} catch {
			done = false;
		}
		if (!done || ta.value !== expected) {
			ta.value = expected;
			ta.dispatchEvent(new Event('input', { bubbles: true }));
		}
	}

	function apply(edit: md.Edit | null) {
		const ta = textarea;
		if (!edit || !ta) return;
		ta.focus();
		hasFocused = true;
		if (edit.from !== edit.to || edit.insert) replaceText(ta, edit.from, edit.to, edit.insert);
		ta.setSelectionRange(edit.select.start, edit.select.end);
	}

	const run = (command: (value: string, sel: md.Range) => md.Edit | null) => () => {
		if (!textarea || mode === 'preview') return;
		apply(command(textarea.value, selection()));
	};

	const bold = run((v, s) => md.toggleInline(v, s, '**', 'bold text'));
	const italic = run((v, s) => md.toggleInline(v, s, '_', 'italic text'));
	const link = run(md.insertLink);
	const quote = run((v, s) => md.toggleLinePrefix(v, s, 'quote'));
	const code = run(md.toggleCode);
	const codeBlock = run(md.insertCodeBlock);
	const bullets = run((v, s) => md.toggleLinePrefix(v, s, 'bullet'));
	const numbers = run((v, s) => md.toggleLinePrefix(v, s, 'ordered'));
	const tasks = run((v, s) => md.toggleLinePrefix(v, s, 'task'));
	const heading = run(md.cycleHeading);
	const table = run(md.insertTable);
	const math = run(md.insertMath);
	const divider = run(md.insertDivider);

	/** Insert text from the help sheet: blocks go on their own paragraph, the rest at the cursor. */
	async function insertSnippet(text: string) {
		if (mode === 'preview') setMode('write');
		await tick();
		const sel = selection();
		const block = /\n/.test(text) || /^(#|>|- |\d+\. |```|\||\$\$|https?:\/\/|!\[)/.test(text);
		apply(block ? md.insertBlock(value, sel, text) : { from: sel.start, to: sel.end, insert: text, select: { start: sel.start + text.length, end: sel.start + text.length } });
	}

	/** For the page: put the cursor in the editor (e.g. to show an error). */
	export function focus() {
		if (mode === 'preview') setMode('write');
		void tick().then(() => textarea?.focus());
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Keyboard                                                                                  */
	/* ---------------------------------------------------------------------------------------- */

	function shortcut(event: KeyboardEvent, action: () => void) {
		event.preventDefault();
		// The admin sidebar toggles on Ctrl/Cmd+B at the window: keep it out of this.
		event.stopPropagation();
		action();
	}

	function ontextkeydown(event: KeyboardEvent) {
		if (event.isComposing || event.keyCode === 229) return;
		const key = event.key.toLowerCase();
		const modifier = event.metaKey || event.ctrlKey;
		if (modifier && !event.altKey) {
			if (!event.shiftKey && key === 'b') return shortcut(event, bold);
			if (!event.shiftKey && key === 'i') return shortcut(event, italic);
			if (!event.shiftKey && key === 'k') return shortcut(event, link);
			if (!event.shiftKey && key === 'e') return shortcut(event, code);
			if (event.shiftKey && event.code === 'Digit7') return shortcut(event, numbers);
			if (event.shiftKey && event.code === 'Digit8') return shortcut(event, bullets);
			if (event.shiftKey && event.code === 'Digit9') return shortcut(event, tasks);
			return;
		}
		if (!textarea) return;
		if (key === 'tab' && !event.altKey) {
			const edit = md.indentList(textarea.value, selection(), event.shiftKey);
			if (edit) {
				event.preventDefault();
				apply(edit);
			}
			return;
		}
		if (key === 'enter' && !event.shiftKey && !event.altKey) {
			const edit = md.continueBlock(textarea.value, selection());
			if (edit) {
				event.preventDefault();
				apply(edit);
			}
		}
	}

	/** Shortcuts that work anywhere in the editor, including the preview. */
	function onrootkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !event.altKey) {
			event.preventDefault();
			void togglePreview();
		} else if (event.key === 'Escape' && fullscreen && !helpOpen && !embedOpen) {
			event.preventDefault();
			fullscreen = false;
		}
	}

	/* Toolbar: one tab stop, arrow keys move between tools. */
	let activeTool = $state('heading');

	function ontoolbarkeydown(event: KeyboardEvent) {
		if (!toolbar || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		const tools = Array.from(toolbar.querySelectorAll<HTMLElement>('[data-tool]:not([disabled])'));
		const index = tools.indexOf(document.activeElement as HTMLElement);
		if (index < 0) return;
		event.preventDefault();
		const next =
			event.key === 'Home' ? 0 : event.key === 'End' ? tools.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tools.length) % tools.length;
		tools[next]?.focus();
	}

	function ontoolfocus(event: FocusEvent) {
		const id = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tool-id]')?.dataset.toolId;
		if (id) activeTool = id;
	}

	const tab = (id: string) => (activeTool === id ? 0 : -1);

	/* ---------------------------------------------------------------------------------------- */
	/* Paste and drop                                                                            */
	/* ---------------------------------------------------------------------------------------- */

	/** Clipboard HTML that is nothing but images (Copy image in a browser). */
	function onlyImages(html: string): boolean {
		const body = html
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<\/?(?:html|head|body|meta|span)[^>]*>/gi, '')
			.trim();
		return !body || /^(?:<img[^>]*>\s*)+$/i.test(body);
	}

	function onpaste(event: ClipboardEvent) {
		const data = event.clipboardData;
		if (!data || !textarea) return;
		const text = data.getData('text/plain');
		const html = data.getData('text/html');
		const files = Array.from(data.files ?? []);

		// Office apps put a picture of the text on the clipboard too: prefer their text.
		const richText = Boolean(text.trim()) && Boolean(html) && !onlyImages(html);
		if (files.length && !richText) {
			event.preventDefault();
			void uploadFiles(files);
			return;
		}

		if (html.includes('<table') && text.includes('\t')) {
			const markdown = md.tsvToTable(text);
			if (markdown) {
				event.preventDefault();
				apply(md.insertBlock(textarea.value, selection(), markdown));
				void announce('Pasted the cells as a Markdown table.');
				toast.success('Pasted as a table.', { description: 'Cells from a spreadsheet become a Markdown table.' });
				return;
			}
		}

		const url = text.trim();
		if (md.isUrl(url)) {
			const edit = md.linkSelection(textarea.value, selection(), url);
			if (edit) {
				event.preventDefault();
				apply(edit);
				void announce('Made the selected text a link.');
				return;
			}
			const embed = md.videoEmbed(url);
			const sel = selection();
			const bounds = md.lineBounds(textarea.value, sel);
			if ((embed || md.isGithubRepo(url)) && sel.start === sel.end && !textarea.value.slice(bounds.start, bounds.end).trim()) {
				event.preventDefault();
				apply(md.insertEmbed(textarea.value, bounds, url));
				void announce(embed ? 'Video link added. It shows as a player in the post.' : 'Repository link added. It shows as a card in the post.');
			}
		}
	}

	let dragDepth = 0;
	let dragging = $state(false);

	const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

	function ondragenter(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth += 1;
		dragging = true;
	}

	function ondragover(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function ondragleave(event: DragEvent) {
		if (!hasFiles(event)) return;
		dragDepth = Math.max(0, dragDepth - 1);
		if (!dragDepth) dragging = false;
	}

	function ondrop(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		dragging = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length) {
			if (mode === 'preview') setMode('write');
			void uploadFiles(files);
		}
	}

	function onfilechange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length) void uploadFiles(files);
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Uploads                                                                                   */
	/* ---------------------------------------------------------------------------------------- */

	type Upload = { id: number; name: string; size: number; fraction: number };
	let uploads = $state<Upload[]>([]);
	let uploadSeq = 0;
	const controllers = new Set<AbortController>();

	$effect(() => {
		uploading = uploads.length > 0;
	});

	const uploadPercent = $derived.by(() => {
		const total = uploads.reduce((n, u) => n + u.size, 0);
		if (!total) return 0;
		return Math.round((uploads.reduce((n, u) => n + u.size * u.fraction, 0) / total) * 100);
	});

	function kindOf(file: File): md.MediaKind {
		const type = fileType(file);
		if (type.startsWith('video/')) return 'video';
		if (type.startsWith('model/')) return 'model';
		if (type === 'application/pdf') return 'pdf';
		return 'image';
	}

	function placeholderFor(name: string, taken: Set<string>): string {
		const base = md.escapeLinkText(name) || 'file';
		let text = `![Uploading ${base}…]()`;
		for (let n = 2; taken.has(text) || value.includes(text); n++) text = `![Uploading ${base} (${n})…]()`;
		taken.add(text);
		return text;
	}

	/** Swap an upload placeholder for its Markdown (or remove it), wherever the text has moved. */
	function replacePlaceholder(placeholder: string, replacement: string): boolean {
		const ta = textarea;
		if (!ta) return false;
		const current = ta.value;
		const at = current.indexOf(placeholder);
		if (at < 0) return false;
		const from = at;
		let to = at + placeholder.length;
		if (!replacement) {
			// Remove the whole line when the placeholder was alone on it.
			const lineStart = from === 0 || current[from - 1] === '\n';
			if (lineStart && current[to] === '\n') to += 1;
		}
		if (document.activeElement === ta) {
			const { selectionStart: start, selectionEnd: end, selectionDirection: dir } = ta;
			replaceText(ta, from, to, replacement);
			const delta = replacement.length - (to - from);
			const shift = (p: number) => (p >= to ? p + delta : p > from ? from + replacement.length : p);
			ta.setSelectionRange(shift(start), shift(end), dir ?? 'none');
		} else {
			ta.setRangeText(replacement, from, to, 'preserve');
			ta.dispatchEvent(new Event('input', { bubbles: true }));
		}
		return true;
	}

	async function uploadFiles(files: File[]) {
		if (!textarea) return;
		const accepted: File[] = [];
		for (const file of files) {
			const problem = checkFile(file);
			if (problem) toast.error(`${file.name}: ${problem}`);
			else accepted.push(file);
		}
		if (!accepted.length) return;

		const taken = new Set<string>();
		const items = accepted.map((file) => ({
			id: ++uploadSeq,
			file,
			kind: kindOf(file),
			placeholder: placeholderFor(file.name, taken)
		}));
		// Photos side by side in one paragraph form a gallery; videos, models and PDFs get their own.
		const photos = items.filter((i) => i.kind === 'image').map((i) => i.placeholder);
		const others = items.filter((i) => i.kind !== 'image').map((i) => i.placeholder);
		const block = [photos.join('\n'), ...others].filter(Boolean).join('\n\n');
		apply(md.insertBlock(textarea.value, selection(), block));

		uploads.push(...items.map((i) => ({ id: i.id, name: i.file.name, size: i.file.size || 1, fraction: 0 })));
		void announce(items.length === 1 ? `Uploading ${items[0].file.name}` : `Uploading ${items.length} files`);

		const done: UploadedMedia[] = [];
		let failed = 0;
		const queue = [...items];
		const worker = async () => {
			for (let item = queue.shift(); item; item = queue.shift()) {
				const controller = new AbortController();
				controllers.add(controller);
				try {
					const media = await uploadFile(item.file, {
						folder,
						keepOriginal,
						alt: md.humanizeFilename(item.file.name),
						signal: controller.signal,
						onProgress: (fraction) => {
							const entry = uploads.find((u) => u.id === item!.id);
							if (entry) entry.fraction = fraction;
						}
					});
					const markdown = md.mediaMarkdown(item.kind, media.url, md.humanizeFilename(item.file.name));
					if (!replacePlaceholder(item.placeholder, markdown)) {
						// The placeholder was deleted while uploading: put the file at the end.
						apply(md.insertBlock(textarea!.value, { start: textarea!.value.length, end: textarea!.value.length }, markdown));
					}
					done.push(media);
				} catch (err) {
					replacePlaceholder(item.placeholder, '');
					if (err instanceof DOMException && err.name === 'AbortError') continue;
					failed += 1;
					toast.error(`Could not upload ${item.file.name}.`, { description: err instanceof Error ? err.message : undefined });
				} finally {
					controllers.delete(controller);
					uploads = uploads.filter((u) => u.id !== item!.id);
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));

		if (done.length) {
			const single = done.length === 1 ? done[0] : null;
			const saved = single ? savings(single) : '';
			const noun = single ? (single.mimeType.startsWith('image/') ? 'Photo' : single.mimeType === 'application/pdf' ? 'PDF' : 'File') : '';
			toast.success(single ? `${noun} uploaded.` : `${done.length} files uploaded.`, {
				description: saved ? `Compressed ${saved}.` : !single && photos.length > 1 ? 'The photos sit together, so the post shows them as a gallery.' : undefined
			});
			void announce(single ? `${noun} uploaded and inserted` : `${done.length} files uploaded and inserted${failed ? `, ${failed} failed` : ''}`);
		} else if (failed) {
			void announce('Upload failed');
		}
	}

	onDestroy(() => {
		for (const controller of controllers) controller.abort();
	});

	/* ---------------------------------------------------------------------------------------- */
	/* Embeds and callouts                                                                       */
	/* ---------------------------------------------------------------------------------------- */

	function openEmbed() {
		if (!textarea || mode === 'preview') return;
		const sel = selection();
		const picked = textarea.value.slice(sel.start, sel.end).trim();
		embedInitial = md.videoEmbed(picked) ? picked : '';
		embedOpen = true;
	}

	let pendingEmbed: string | null = null;
	function onembed(url: string) {
		pendingEmbed = url;
	}

	function afterEmbedClose(event: Event) {
		if (!textarea) return;
		event.preventDefault();
		const url = pendingEmbed;
		pendingEmbed = null;
		if (url) apply(md.insertEmbed(textarea.value, selection(), url));
		else textarea.focus();
	}

	type Callout = { type: md.CalloutType; label: string; hint: string; icon: Component<{ class?: string; 'aria-hidden'?: 'true' }> };
	const CALLOUTS: Callout[] = [
		{ type: 'NOTE', label: 'Note', hint: 'Useful context', icon: InfoIcon },
		{ type: 'TIP', label: 'Tip', hint: 'A better way to do it', icon: LightbulbIcon },
		{ type: 'IMPORTANT', label: 'Important', hint: 'Do not skip this', icon: MessageSquareImportantIcon },
		{ type: 'WARNING', label: 'Warning', hint: 'Something can go wrong', icon: TriangleAlertIcon },
		{ type: 'CAUTION', label: 'Caution', hint: 'Risk of damage or injury', icon: OctagonAlertIcon }
	];
	let pendingCallout: md.CalloutType | null = null;

	function afterCalloutClose(event: Event) {
		const type = pendingCallout;
		pendingCallout = null;
		if (!type || !textarea) return;
		event.preventDefault();
		apply(md.insertCallout(textarea.value, selection(), type));
	}

	let pendingSnippet: string | null = null;
	function afterHelpClose(event: Event) {
		const text = pendingSnippet;
		pendingSnippet = null;
		if (!text) return;
		event.preventDefault();
		void insertSnippet(text);
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Preview                                                                                   */
	/* ---------------------------------------------------------------------------------------- */

	let previewHtml = $state('');
	let previewBusy = $state(false);
	let previewError = $state<string | null>(null);
	let previewKey = '';
	let previewController: AbortController | null = null;

	async function loadPreview(markdown: string, start: number, key: string) {
		previewController?.abort();
		const controller = new AbortController();
		previewController = controller;
		previewBusy = true;
		try {
			const response = await fetch('/admin/api/preview', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ markdown, figureStart: start }),
				signal: controller.signal
			});
			const body = (await response.json().catch(() => null)) as { html?: string; message?: string } | null;
			if (!response.ok || typeof body?.html !== 'string') {
				throw new Error(body?.message ?? (response.status === 401 ? 'Your session has ended. Sign in again to see the preview.' : `The preview failed (${response.status}).`));
			}
			previewHtml = body.html;
			previewKey = key;
			previewError = null;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			previewError = err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Could not reach the server for the preview.';
		} finally {
			if (previewController === controller) {
				previewController = null;
				previewBusy = false;
			}
		}
	}

	$effect(() => {
		if (mode === 'write') return;
		const markdown = value;
		const start = figureStart;
		const key = `${start}\u0000${markdown}`;
		if (key === previewKey) return;
		// The first render is immediate; later ones wait until typing pauses.
		const timer = setTimeout(() => void loadPreview(markdown, start, key), previewKey ? 400 : 0);
		return () => clearTimeout(timer);
	});

	onDestroy(() => previewController?.abort());

	/* Split view: keep both sides at the same place, by proportion. */
	let scrollLead: 'editor' | 'preview' | null = null;
	let scrollFrame = 0;

	function sync(from: HTMLElement | null | undefined, to: HTMLElement | null | undefined, who: 'editor' | 'preview') {
		if (mode !== 'split' || !from || !to) return;
		if (scrollLead && scrollLead !== who) return;
		scrollLead = who;
		const max = from.scrollHeight - from.clientHeight;
		const ratio = max > 0 ? from.scrollTop / max : 0;
		to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
		cancelAnimationFrame(scrollFrame);
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = requestAnimationFrame(() => (scrollLead = null));
		});
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Fullscreen                                                                                */
	/* ---------------------------------------------------------------------------------------- */

	$effect(() => {
		if (!fullscreen) return;
		const html = document.documentElement;
		const previous = html.style.overflow;
		html.style.overflow = 'hidden';
		void announce('Fullscreen. Press Escape to leave.');
		return () => {
			html.style.overflow = previous;
		};
	});

	async function toggleFullscreen() {
		fullscreen = !fullscreen;
		await tick();
		if (mode !== 'preview') textarea?.focus();
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Status line                                                                               */
	/* ---------------------------------------------------------------------------------------- */

	// Counted a moment after typing stops: segmenting a long post on every key is wasteful.
	let counted = $state(untrack(() => value));
	$effect(() => {
		const next = value;
		const timer = setTimeout(() => (counted = next), 250);
		return () => clearTimeout(timer);
	});
	const words = $derived(countMarkdownWords(counted));
	const bytes = $derived(byteLength(counted));
	const nearLimit = $derived(bytes > LIMITS.bodyBytes * 0.8);
	const overLimit = $derived(bytes > LIMITS.bodyBytes);

	const writing = $derived(mode !== 'preview');
	const toggleItemClass =
		'h-9 gap-1.5 rounded-sm px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-300 hover:text-ink data-[state=on]:bg-surface-300 data-[state=on]:text-ink [&_svg]:size-4';
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={[
		'flex min-w-0 flex-col overflow-hidden border border-line bg-surface-200',
		fullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'relative rounded-lg',
		error && !fullscreen && 'border-brand-text/60',
		className
	]}
	role="group"
	aria-label="Post body editor"
	onkeydown={onrootkeydown}
	{ondragenter}
	{ondragover}
	{ondragleave}
	{ondrop}
>
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-line p-2">
		<ToggleGroup.Root
			type="single"
			value={mode}
			onValueChange={(next) => next && setMode(next as EditorMode)}
			aria-label="Editor mode"
			spacing={1}
			class="gap-1"
		>
			<ToggleGroup.Item value="write" class={toggleItemClass}><PencilIcon aria-hidden="true" />Write</ToggleGroup.Item>
			<ToggleGroup.Item value="preview" class={toggleItemClass}><EyeIcon aria-hidden="true" />Preview</ToggleGroup.Item>
			<ToggleGroup.Item value="split" class={['hidden md:inline-flex', toggleItemClass].join(' ')}>
				<Columns2Icon aria-hidden="true" />Split
			</ToggleGroup.Item>
		</ToggleGroup.Root>

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			bind:this={toolbar}
			role="toolbar"
			aria-label="Formatting"
			aria-controls={textareaId}
			tabindex={-1}
			class="flex flex-wrap items-center gap-0.5"
			onkeydown={ontoolbarkeydown}
			onfocusin={ontoolfocus}
		>
			<ToolButton data-tool-id="heading" tabindex={tab('heading')} label="Heading (section, subsection)" icon={HeadingIcon} disabled={!writing} onclick={heading} />
			<ToolButton data-tool-id="bold" tabindex={tab('bold')} label="Bold" icon={BoldIcon} keys={keys('B')} shortcut={aria('B')} disabled={!writing} onclick={bold} />
			<ToolButton data-tool-id="italic" tabindex={tab('italic')} label="Italic" icon={ItalicIcon} keys={keys('I')} shortcut={aria('I')} disabled={!writing} onclick={italic} />
			<ToolButton data-tool-id="link" tabindex={tab('link')} label="Link" icon={LinkIcon} keys={keys('K')} shortcut={aria('K')} disabled={!writing} onclick={link} />
			<Separator orientation="vertical" class="mx-1 h-5! bg-line" />
			<ToolButton data-tool-id="quote" tabindex={tab('quote')} label="Quote" icon={QuoteIcon} disabled={!writing} onclick={quote} />
			<ToolButton data-tool-id="code" tabindex={tab('code')} label="Code" icon={CodeIcon} keys={keys('E')} shortcut={aria('E')} disabled={!writing} onclick={code} />
			<ToolButton data-tool-id="codeblock" tabindex={tab('codeblock')} label="Code block" icon={SquareCodeIcon} disabled={!writing} onclick={codeBlock} />
			<Separator orientation="vertical" class="mx-1 h-5! bg-line" />
			<ToolButton data-tool-id="bullets" tabindex={tab('bullets')} label="Bulleted list" icon={ListIcon} keys={keys('Shift', '8')} shortcut={aria('8', true)} disabled={!writing} onclick={bullets} />
			<ToolButton data-tool-id="numbers" tabindex={tab('numbers')} label="Numbered list" icon={ListOrderedIcon} keys={keys('Shift', '7')} shortcut={aria('7', true)} disabled={!writing} onclick={numbers} />
			<ToolButton data-tool-id="tasks" tabindex={tab('tasks')} label="Task list" icon={ListTodoIcon} keys={keys('Shift', '9')} shortcut={aria('9', true)} disabled={!writing} onclick={tasks} />
			<Separator orientation="vertical" class="mx-1 h-5! bg-line" />
			<ToolButton data-tool-id="table" tabindex={tab('table')} label="Table" icon={TableIcon} disabled={!writing} onclick={table} />
			<ToolButton data-tool-id="image" tabindex={tab('image')} label="Image, video, 3D model or PDF" icon={ImageIcon} disabled={!writing} onclick={() => fileInput?.click()} />
			<ToolButton data-tool-id="embed" tabindex={tab('embed')} label="Embed video" icon={PlayIcon} disabled={!writing} onclick={openEmbed} />
			<DropdownMenu.Root>
				<DropdownMenu.Trigger disabled={!writing}>
					{#snippet child({ props })}
						<ToolButton {...props} data-tool-id="callout" tabindex={tab('callout')} label="Callout" icon={MessageSquareTextIcon} disabled={!writing} />
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="w-64 border border-line bg-surface-200" align="end" onCloseAutoFocus={afterCalloutClose}>
					<DropdownMenu.Label class="text-label text-[11px] text-ink-muted">Callout</DropdownMenu.Label>
					{#each CALLOUTS as callout (callout.type)}
						<DropdownMenu.Item class="min-h-11 gap-3" onSelect={() => (pendingCallout = callout.type)}>
							<callout.icon
								aria-hidden="true"
								class={callout.type === 'WARNING' || callout.type === 'CAUTION' ? 'text-brand-text' : 'text-ink-muted'}
							/>
							<span class="flex flex-col">
								<span class="text-sm text-ink">{callout.label}</span>
								<span class="text-xs text-ink-muted">{callout.hint}</span>
							</span>
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<ToolButton data-tool-id="math" tabindex={tab('math')} label="Math (LaTeX)" icon={SigmaIcon} disabled={!writing} onclick={math} />
			<ToolButton data-tool-id="divider" tabindex={tab('divider')} label="Divider" icon={SeparatorIcon} disabled={!writing} onclick={divider} />
			<Separator orientation="vertical" class="mx-1 h-5! bg-line" />
			<ToolButton data-tool-id="help" tabindex={tab('help')} label="Markdown help" icon={CircleQuestionIcon} onclick={() => (helpOpen = true)} />
			<ToolButton
				data-tool-id="fullscreen"
				tabindex={tab('fullscreen')}
				label={fullscreen ? 'Leave fullscreen' : 'Fullscreen'}
				icon={fullscreen ? Minimize2Icon : Maximize2Icon}
				keys={fullscreen ? ['Esc'] : undefined}
				pressed={fullscreen}
				onclick={toggleFullscreen}
			/>
		</div>
	</div>

	<div
		class={[
			'relative grid min-h-0 bg-surface-100',
			fullscreen ? 'flex-1' : 'h-[clamp(380px,66vh,760px)]',
			mode === 'split' ? 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1' : 'grid-cols-1'
		]}
	>
		<div class={['min-h-0', mode === 'preview' && 'hidden', mode === 'split' && 'border-b border-line lg:border-r lg:border-b-0']}>
			<Label for={textareaId} class="sr-only">{label}</Label>
			<Textarea
				bind:ref={textarea}
				bind:value
				id={textareaId}
				{name}
				{placeholder}
				spellcheck={true}
				autocapitalize="sentences"
				aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(' ')}
				aria-invalid={error ? 'true' : undefined}
				class={[
					'h-full min-h-0 resize-none rounded-none border-0 bg-surface-100 py-5 font-mono text-[14px] leading-6 text-ink shadow-none [field-sizing:fixed] focus-visible:ring-1 focus-visible:ring-line-strong focus-visible:ring-inset md:text-[14px] dark:bg-surface-100',
					fullscreen && mode === 'write' ? 'px-[max(20px,calc((100%-76ch)/2))]' : 'px-5'
				].join(' ')}
				onkeydown={ontextkeydown}
				{onpaste}
				onfocus={() => (hasFocused = true)}
				onscroll={() => sync(textarea, previewEl, 'editor')}
			/>
		</div>

		{#if mode !== 'write'}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				bind:this={previewEl}
				class="relative min-h-0 overflow-y-auto px-5 py-6 outline-none focus-visible:ring-1 focus-visible:ring-line-strong focus-visible:ring-inset sm:px-8"
				tabindex="0"
				role="region"
				aria-label="Preview"
				aria-busy={previewBusy}
				onscroll={() => sync(previewEl, textarea, 'preview')}
			>
				{#if previewBusy}
					<span class="text-label pointer-events-none absolute top-3 right-4 flex items-center gap-1.5 text-[11px] text-ink-muted">
						<Spinner class="size-3" aria-hidden="true" />Updating
					</span>
				{/if}
				{#if previewError}
					<p class="m-0 mb-4 rounded-sm border border-brand-text/50 bg-brand/10 px-3 py-2 text-sm text-brand-text" role="alert">{previewError}</p>
				{/if}
				{#if !value.trim()}
					<p class="m-0 text-sm text-ink-muted">Nothing to preview yet. Write something on the Write tab.</p>
				{:else if previewHtml}
					<PostBody html={previewHtml} class="mx-auto max-w-[720px]" />
				{:else if !previewError}
					<p class="m-0 text-sm text-ink-muted">Rendering the preview…</p>
				{/if}
			</div>
		{/if}

		{#if dragging}
			<div
				class="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-muted bg-surface-100/90 text-center"
				aria-hidden="true"
			>
				<CloudUploadIcon class="size-7 text-ink-muted" />
				<p class="m-0 text-sm font-medium text-ink">Drop to upload</p>
				<p class="m-0 text-xs text-ink-muted">Photos, videos, GLB models and PDFs. Several photos make a gallery.</p>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-3.5 py-2.5 text-xs leading-[18px] text-ink-muted">
		<span>
			Markdown · {words.toLocaleString('en-US')} {words === 1 ? 'word' : 'words'} · {readingMinutes(words)} min read
			{#if nearLimit}
				<span class={overLimit ? 'text-brand-text' : ''}>· {formatBytes(bytes)} of {formatBytes(LIMITS.bodyBytes)}</span>
			{/if}
		</span>
		{#if uploads.length}
			<span class="flex items-center gap-1.5 text-ink">
				<Spinner class="size-3.5" aria-hidden="true" />
				Uploading {uploads.length === 1 ? uploads[0].name : `${uploads.length} files`} · {uploadPercent}%
			</span>
		{/if}
		{#if savedLabel}<span>{savedLabel}</span>{/if}
	</div>
	{#if error}
		<p id={errorId} class="m-0 border-t border-line px-3.5 py-2 text-xs text-brand-text">{error}</p>
	{/if}
	<p id={hintId} class="sr-only">
		Markdown. Paste or drop images to upload them. {mod} plus Enter switches to the preview. Tab nests list items.
	</p>
	<div class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
</div>

<input
	bind:this={fileInput}
	type="file"
	multiple
	accept={acceptAttribute()}
	class="hidden"
	tabindex={-1}
	aria-hidden="true"
	onchange={onfilechange}
/>

<Sheet.Root bind:open={helpOpen}>
	<Sheet.Content side="right" class="w-full gap-0 overflow-y-auto border-line bg-surface-200 data-[side=right]:w-full data-[side=right]:sm:max-w-md" onCloseAutoFocus={afterHelpClose}>
		<Sheet.Header class="border-b border-line">
			<Sheet.Title class="font-display text-lg font-semibold">Markdown help</Sheet.Title>
			<Sheet.Description class="text-sm text-ink-muted">Everything a post can do. Insert puts the example at the cursor.</Sheet.Description>
		</Sheet.Header>
		<MarkdownHelp
			class="p-4"
			oninsert={(text) => {
				pendingSnippet = text;
				helpOpen = false;
			}}
		/>
	</Sheet.Content>
</Sheet.Root>

<EmbedDialog bind:open={embedOpen} initial={embedInitial} oninsert={onembed} onCloseAutoFocus={afterEmbedClose} />
