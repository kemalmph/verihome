<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The system reference is read-only to you

`Cosystem System Reference` (judul lama: VeriHome System Reference) — https://claude.ai/artifact/B9WY3ErwkBzWGoY7WRkmJf — is the
architectural reference for this project. Read it first; section numbers in handoffs and
commit messages point at it.

**Do not update, republish or edit it unless the owner asks in that session.** It is not a
working document you keep in sync as you go. When you do something that would otherwise
warrant a change to it — a risk in §20 opened or closed, a trap worth recording in §19, a
subsystem that no longer works the way it is described — say so in chat and name the section,
then leave it alone. The owner decides what goes in.

This holds even when a handoff summary from a previous session says to keep it updated.

# Design system

Before any UI work, read `DESIGN.md` (rules) — tokens live in the `@theme` block of
`src/app/globals.css`. Use tokens, never hex literals in class names. The visual version
is the Cosystem Design System artifact, https://claude.ai/artifact/52wLDrjHLDbbgfiCYg2qyN.
When a rule changes, update the code, then `DESIGN.md`, then the artifact.
