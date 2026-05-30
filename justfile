# Development server (TypeScript 直実行)
dev *args:
    bun run dev {{args}}

# TypeScript → dist/ にビルド
build:
    bun run build

# ビルド済み CLI を実行
run *args:
    bun run start {{args}}

# 型チェック（emit なし）
typecheck:
    bun run typecheck

# Biome でリント & 自動修正
lint:
    bun run lint

# Biome でフォーマット
format:
    bun run format

# Biome check + 自動修正（lint + format 一括）
fix:
    bun run biome:fix
