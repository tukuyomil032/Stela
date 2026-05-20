# stela

A TypeScript CLI that lets you view starred repositories, unstar them, and search for repositories by language or genre to star new ones

## Installation

Stela is hosted on GitHub Packages. To install it, you need to configure your npm environment to authenticate with GitHub.

### 1. Generate a Personal Access Token

Generate a GitHub Personal Access Token (PAT) ensuring you grant the following permissions:
- `repo`
- `write:packages`

### 2. Configure npm registry

Add the following lines to your global `.npmrc`(**Not Project root**) file to authenticate with GitHub Packages. Make sure to replace `ghp_XXXXXXXX` with your actual PAT.

```ini
@tukuyomil032:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=ghp_XXXXXXXX
```

> **Note**: If you have previously logged in to npm via `npm login`, you may see a line like `//registry.npmjs.org/:_authToken=...` in your `.npmrc`. Please leave it completely intact.

### 3. Install the CLI

Once authenticated, install the package globally using `npm`:

```bash
npm install -g @tukuyomil032/stela
```
