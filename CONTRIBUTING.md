# Contributing to ARA

Thank you for your interest in contributing to the ARA (Agent-Ready Architecture) standard! This is an open project and we welcome contributions of all kinds.

## Ways to Contribute

### Report Issues
- Found a problem with the spec? [Open an issue](https://github.com/ARA-Standard/ara-standard/issues/new).
- Include a clear description, relevant examples, and your suggested fix.

### Suggest Improvements
- Have an idea for a new feature or change? Start a [Discussion](https://github.com/ARA-Standard/ara-standard/discussions).
- Describe the use case, proposed solution, and any alternatives you considered.

### Submit Examples
- Create ARA manifests for new site types (healthcare, education, government, etc.).
- Improve existing examples with more realistic data.

### Improve Documentation
- Fix typos, clarify explanations, add diagrams.
- Translate documentation into other languages.

### Build Tools
- Create or improve validators, generators, CMS plugins, or SDKs.
- See the `tools/` directory for existing tools.

### Implement ARA
- Make your own website ARA-ready and share your experience.
- Create a PR to add your site to the ARA-ready directory.

## Making Changes

### For Specification Changes

1. **Fork** the repository.
2. **Create a branch** from `main`: `git checkout -b proposal/your-change`.
3. **Make your changes** in the relevant `spec/` files.
4. **Write a clear description** of what you changed and why.
5. **Submit a Pull Request** with the label `spec-change`.

Spec changes go through a review period:
- Minor clarifications: 1 week review.
- New features: 2 week review + community discussion.
- Breaking changes: 4 week review + RFC process.

### For Examples and Tools

1. **Fork** the repository.
2. **Create a branch**: `git checkout -b add/your-contribution`.
3. **Make your changes**.
4. **Test** your changes (validate JSON, run tools, etc.).
5. **Submit a Pull Request**.

### For Documentation

- Minor fixes (typos, formatting): Submit a PR directly.
- Major changes: Open a Discussion first to align on approach.

## Code of Conduct

- Be respectful and constructive.
- Focus on the technical merits of proposals.
- Welcome newcomers and help them contribute.
- No personal attacks, harassment, or discrimination.

## Style Guide

### JSON Files
- Use 2-space indentation.
- Use `snake_case` for property names.
- Include `description` fields for clarity.
- Validate against the ARA JSON Schema before submitting.

### Markdown Files
- Use ATX-style headers (`#`, `##`, `###`).
- Include a table of contents for long documents.
- Use code blocks with language annotations.
- Keep line length reasonable (wrap at ~100 characters for prose).

### Code (Tools)
- Include JSDoc or docstring comments for public functions.
- Add a README with usage instructions.
- Include a `package.json` with appropriate metadata.
- Write tests where practical.

## Questions?

- Open a [Discussion](https://github.com/ARA-Standard/ara-standard/discussions) for general questions.
- Email ara-support@ara-standard.org for private inquiries.

Thank you for helping make the web agent-ready!
