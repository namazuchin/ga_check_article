# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action for proofreading technical blog articles written in Markdown. The action integrates with reviewdog to provide automated feedback on Pull Requests, checking for:

- Typos and spelling errors
- Proper noun consistency 
- Readability issues
- Style and expression problems

## Architecture

Based on the Architecture.md document, this project implements:

- **Node.js-based GitHub Action** with entry point at `dist/index.js` (bundled)
- **Modular checker system** in `src/checkers/` for different validation types
- **Custom dictionary support** via `custom_dict/` directory
- **reviewdog integration** for PR feedback using RDFormat JSON output
- **textlint-based validation** with various Japanese technical writing rules

## Expected File Structure

The project follows this structure (as documented in Architecture.md):
```
├── action.yml               # GitHub Action definition
├── package.json             # Node.js dependencies  
├── dist/index.js           # Bundled entry point
├── src/                    # Source code
│   ├── index.js           # Action entry point
│   ├── main.js            # Core proofreading logic
│   ├── checkers/          # Individual check modules
│   └── utils.js           # Shared utilities
├── custom_dict/           # Custom dictionaries
└── .github/workflows/     # CI/CD workflows
```

## Key Technologies

- **@actions/core** and **@actions/github** for GitHub Actions integration
- **@vercel/ncc** for bundling to single file
- **reviewdog** for PR integration
- **textlint** with Japanese technical writing rules
- **kuromoji.js** for morphological analysis

## Development Notes

- Action outputs results in RDFormat JSON Lines for reviewdog consumption
- Custom dictionaries in `custom_dict/` support proper noun validation
- Main processing logic should be in `src/main.js` with modular checkers
- Build process bundles everything to `dist/index.js` using ncc