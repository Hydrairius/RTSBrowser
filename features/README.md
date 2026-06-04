# Features

Each subdirectory under `features/` is a **vertical slice** of the RTS (e.g. combat, economy, map-terrain).

## Structure

```
<feature-name>/
├── data/      # Design docs, schemas, balance, content
├── skills/    # Agent SKILL.md files for this domain
└── tools/     # Scripts and dev utilities
```

## Adding a feature

1. Copy `_template/` to a new kebab-case folder name.
2. Fill in `data/README.md` with scope and open questions.
3. Add agent skills under `skills/` as the domain stabilizes.
4. Add scripts under `tools/` when repetitive work appears.
5. Register the feature in the table in [../AGENTS.md](../AGENTS.md).

Do not commit large binary assets under `data/` without documenting source and license in that feature’s README.
