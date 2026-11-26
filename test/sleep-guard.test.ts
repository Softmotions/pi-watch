import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCommand } from "../src/sleep-guard.ts";

const opts = { thresholdS: 10 };

test("long sleep is blocked, short sleep passes", () => {
	assert.equal(checkCommand("sleep 20", opts).block, true);
	assert.equal(checkCommand("sleep 2", opts).block, false);
	assert.equal(checkCommand("sleep 10", opts).block, true);
});

test("the screenshots: compound sleep and polling loop are blocked", () => {
	assert.equal(checkCommand("sleep 20; npm view @igor-guari/pi-status-line version --prefer-online", opts).block, true);
	const loop =
		'for i in $(seq 1 10); do v=$(npm view x version 2>/dev/null); [ "$v" = "0.2.0" ] && break; sleep 15; done; echo "registro: $v"';
	assert.equal(checkCommand(loop, opts).block, true);
});

test("any loop containing sleep is blocked, even with a short sleep", () => {
	assert.equal(checkCommand("while ! curl -sf localhost:3000; do sleep 1; done", opts).block, true);
	assert.equal(checkCommand("until gh run view 1 --json status | grep -q completed; do sleep 2; done", opts).block, true);
	assert.equal(checkCommand("for f in *.ts; do echo $f; done", opts).block, false);
});

test("unit suffixes count toward the threshold", () => {
	assert.equal(checkCommand("sleep 1m", opts).block, true);
	assert.equal(checkCommand("sleep 5s", opts).block, false);
	assert.equal(checkCommand("sleep 1h", opts).block, true);
});

test("sleep inside quotes or comments is not a sleep", () => {
	assert.equal(checkCommand('echo "sleep 99"', opts).block, false);
	assert.equal(checkCommand("git commit -m 'remove sleep 30 from loop'", opts).block, false);
	assert.equal(checkCommand("ls # sleep 60", opts).block, false);
	assert.equal(checkCommand("grep -rn 'for x do sleep 1 done' src", opts).block, false);
	assert.equal(checkCommand("./sleepy 30", opts).block, false);
});

test("heredoc bodies are data, not shell: loops and sleeps inside them pass", () => {
	// The real false positive: a python heredoc writing a shell script that polls with sleep.
	const edit = `python3 - <<'PY'
p='dev/test-requests-archive.sh'
s=open(p).read()
s=s.replace('''stop_app''','''start_app || exit 1
for _ in $(seq 1 120); do
  [ "$(released_gen)" != "$GEN" ] && break
  sleep 0.5
done''')
open(p,'w').write(s)
PY
timeout 110 mvn -q -o compile`;
	assert.equal(checkCommand(edit, opts).block, false);
	assert.equal(checkCommand("cat > run.sh <<EOF\nwhile true; do\n  sleep 30\ndone\nEOF\nchmod +x run.sh", opts).block, false);
	assert.equal(checkCommand("cat > run.sh <<-RUN\n\tsleep 60\n\tRUN\n", opts).block, false);
});

test("executable loops outside a heredoc, or without a terminator, are still blocked", () => {
	assert.equal(
		checkCommand("cat > f <<EOF\nsleep 1\nEOF\nwhile ! curl -sf localhost:3000; do sleep 1; done", opts).block,
		true,
	);
	assert.equal(checkCommand("cat > f <<EOF\nno terminator here\nwhile ! read -r x; do sleep 1; done", opts).block, true);
	assert.equal(checkCommand("git commit -m 'cat <<EOF' && sleep 20", opts).block, true);
	assert.equal(checkCommand("ls # <<EOF\nfor i in 1 2; do sleep 1; done", opts).block, true);
});

test("heredoc-like syntax that is not a heredoc does not swallow the command", () => {
	assert.equal(checkCommand("echo $((1 << 3)); read -r x <<< 'a b'; sleep 20", opts).block, true);
});

test("a heredoc fed to a shell is a script, not data: it stays guarded", () => {
	assert.equal(checkCommand("bash <<'EOF'\nfor i in 1 2; do sleep 20; done\nEOF", opts).block, true);
	assert.equal(checkCommand("sudo sh -e <<-EOF\n\tsleep 30\n\tEOF", opts).block, true);
	assert.equal(checkCommand("cat > f <<EOF\nfor i in 1 2; do sleep 20; done\nEOF", opts).block, false);
});
