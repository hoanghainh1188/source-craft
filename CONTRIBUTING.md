# Contributing to SourceCraft

Thanks for your interest! Issues and pull requests can be written in **English or Vietnamese**.

## Reporting bugs and ideas

- **Bug:** open an issue with the _Bug report_ template. Include your OS, the app version (the installer file
  name, e.g. `SourceCraft-0.2.8-arm64.dmg`) and, if possible, the log file — open it from
  **Cài đặt (Settings) → Lưu trữ cục bộ (Local storage) → Nhật ký lỗi (Error log)**. Logs are redacted (no
  document text or API keys), but please check before attaching. The same row can pre-fill a bug report for you
  to review and submit.
- **Idea / feature request:** open an issue describing the problem you want solved before proposing a design.
- **Security issue:** please do **not** open a public issue — contact the maintainer privately via the email on
  their GitHub profile.

## Pull requests

1. Fork the repo and create a branch from `main`. Maintainers use `NNN-<slug>` (`NNN` = issue number,
   zero-padded to 3 digits); for outside contributions `fix/<short-name>` or `feat/<short-name>` is fine.
2. Keep the invariants in [`.specify/memory/constitution.md`](.specify/memory/constitution.md): no new network
   egress by default, every answer stays verifiable (citations map to exact source positions), all file / DB /
   model / network access stays in the main process behind the whitelisted preload bridge.
3. Add tests (Vitest for logic, Playwright for user flows). Business-logic coverage must stay ≥ 80%.
4. Before opening the PR, run:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

   CI also runs the Playwright E2E suite.

5. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).

## Where things are

- Product overview and constraints: [`docs/OVERVIEW.md`](docs/OVERVIEW.md) (Vietnamese).
- Domain glossary with the English names used in code: [`docs/00-glossary.md`](docs/00-glossary.md).
- Architecture decisions (ADRs): [`docs/04-decisions/`](docs/04-decisions/) — check here before re-opening a
  question that has already been decided.
- Larger features follow a spec-driven workflow (GitHub Spec Kit) described in [`CLAUDE.md`](CLAUDE.md) and
  [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md); outside contributors don't need to use it for bug fixes.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
