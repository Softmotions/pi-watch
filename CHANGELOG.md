# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-11-26

### Fixed

- The `sleep` / polling-loop guard no longer fires on loops that live inside a heredoc body
  (`python3 - <<'PY' … PY`, `cat > run.sh <<'EOF' … EOF`): that text is written, not run. Heredocs fed
  to a shell (`bash <<'EOF' … EOF`) stay guarded, and `<<<` here-strings or `<<` shifts are not
  mistaken for heredocs. The same fix stops the long-command guard from matching written script
  content.

## [0.2.1] - 2026-11-26

### Fixed

- Process watches now expose the accumulated `stdout`/`stderr` text in their `line` and `exit`
  observations, so text conditions such as `{ "stdout": { "contains": "exit=0" } }` match instead of
  settling as `process exited with code 0 without matching success`. The captured text is bounded to
  the last 64 KB per stream (trimmed at 2x for amortized O(1) appends), so it is independent of the
  in-memory line tail.
- A watch registered on an already-exited process can now match its output text as well.

### Changed

- The `bash` timeout guard exempts `sudo`: the wait is the password prompt and `process_start` has no
  TTY.

### Added

- CI on pull requests and `main` (tests on Node 24 plus a gitleaks secret scan).
- npm publishing via Trusted Publishing (OIDC) on `v*` tags, with tag/version validation.
- Dependabot auto-merge for patch and minor updates, and PR title checks.
- Git hooks that block commits and pushes to protected branches and scan staged changes for secrets.

## [0.2.0] - 2026-11-02

### Added

- `bash` timeout guard: blocks long-running `bash` calls and hints when a slow call should have been
  a `process_start` watch; opt-in long-command list via `PI_WATCH_LONG_COMMANDS`.
- README, demo recording and gallery video.

### Changed

- Theme-colored unicode symbols (`✓ ✗ ◷ !`) instead of emoji in watch results.

## [0.1.0] - 2026-10-28

### Added

- Initial release: `process_start`/`watch_create` wait for a process or an external poll without
  blocking the Pi turn, with declarative success/failure conditions, deadlines, batched delivery and
  a sleep guard for `bash`.
