# Submission path budget

The maximum complete submission is 8,388,608 bytes. The explicit budget for
`.gitignore` is 1,024 bytes. Its scope is generated dependencies, package-manager
caches, temporary browser evidence, and scratch files at every nesting level.
The production `dist/` export is deliberately included.

Planned upper bounds: source and ABIs 600 KiB; public assets 300 KiB; dist 5 MiB;
package manifest and lockfile 600 KiB; documentation, tests and scripts 400 KiB.
The final measured footprint is recorded in `docs/VALIDATION.md`.
