## Unreleased

### Fixed

- Deduplicate `no-env-secrets-client` reports so fallback scanning does not double-report when AST visitor already found an issue. (Added tests covering comments, string literals, template literals, and JSX cases.)
