export type GuardResult = { block: false } | { block: true; reason: string };

const UNIT_SECONDS: Record<string, number> = { "": 1, s: 1, m: 60, h: 3600, d: 86400 };
const SLEEP = /\bsleep\s+(\d+(?:\.\d+)?)([smhd]?)\b/g;
const LOOP = /\b(for|while|until)\b[\s\S]*?\bdo\b[\s\S]*?\bdone\b/g;

/** Blank out quoted strings, comments and heredoc bodies so only executable words remain. */
export function stripInert(cmd: string): string {
	return stripHeredocs(cmd)
		.replace(/'[^']*'/g, "''")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')
		.replace(/(^|\s)#[^\n]*/g, "$1");
}

/**
 * Drop heredoc bodies: `cat > script.sh <<'EOF' … EOF` writes text, it does not run it, so a loop or
 * `sleep` inside the body must not trip the guards.
 */
function stripHeredocs(cmd: string): string {
	const lines = cmd.split("\n");
	const out: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		out.push(lines[i]);
		const start = findHeredoc(lines[i]);
		if (!start) continue;
		let end = i + 1;
		while (end < lines.length && lines[end].trim() !== start.delim) end++;
		if (end >= lines.length) continue; // no terminator line: not a heredoc, keep scanning
		if (SHELL_FEEDS_HEREDOC.test(lines[i].slice(0, start.at))) continue; // `bash <<EOF` runs the body
		i = end;
		out.push("");
	}
	return out.join("\n");
}

/** `bash <<EOF`, `sudo sh -e <<'EOF'`: this heredoc is a script that runs, so its body stays guarded. */
const SHELL_FEEDS_HEREDOC = /(?:^|[;&|({])\s*(?:sudo\s+)?(?:\w+=\S+\s+)*(?:ba|da|k|z|a)?sh(?:\s+-\S+)*\s*$/;

function findHeredoc(line: string): { delim: string; at: number } | undefined {
	for (const m of line.matchAll(/(?:^|[^<])<<-?\s*(['"]?)([A-Za-z_]\w*)\1/g)) {
		const at = m.index + m[0].indexOf("<<");
		if (!inertAt(line, at)) return { delim: m[2], at };
	}
	return undefined;
}

/** True when `at` sits inside a quoted string or a `#` comment, i.e. it is data, not shell syntax. */
function inertAt(line: string, at: number): boolean {
	let quote: string | undefined;
	for (let i = 0; i < at; i++) {
		const ch = line[i];
		if (quote === '"' && ch === "\\") i++;
		else if (quote) quote = ch === quote ? undefined : quote;
		else if (ch === "'" || ch === '"') quote = ch;
		else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) return true;
	}
	return quote !== undefined;
}

export function checkCommand(raw: string, opts: { thresholdS: number }): GuardResult {
	const cmd = stripInert(raw);
	for (const loop of cmd.matchAll(LOOP)) {
		if (/\bsleep\s+\d/.test(loop[0])) {
			return { block: true, reason: `polling loop with sleep (\`${loop[1]} … sleep … done\`)` };
		}
	}
	for (const m of cmd.matchAll(SLEEP)) {
		const seconds = Number(m[1]) * UNIT_SECONDS[m[2]];
		if (seconds >= opts.thresholdS) return { block: true, reason: `\`sleep ${m[1]}${m[2]}\` (≥ ${opts.thresholdS}s)` };
	}
	return { block: false };
}
