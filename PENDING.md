# Still open (outside this task)

- A watch registered on a *still running* process does not replay output printed before
  `createWatch` (only lines arriving afterwards are evaluated; the accumulated
  `stdout`/`stderr` text is used at exit). Deciding whether a late watch should be
  satisfied by earlier output is a design call.
