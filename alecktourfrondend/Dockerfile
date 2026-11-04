# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# El pnpm real usado es el que fija "packageManager" en package.json
# (pnpm@11.0.9) -- corepack lo detecta solo y lo antepone a cualquier
# version que se le pida preparar a mano, así que fijar aquí un pnpm
# distinto (como se hacía antes con pnpm@8) no tenía ningún efecto real
# y quedaba engañoso. pnpm-workspace.yaml también se copia ahora: sin
# él, "pnpm install --frozen-lockfile" no ve "allowBuilds" y falla con
# [ERR_PNPM_IGNORED_BUILDS] (esbuild/@tailwindcss/oxide/core-js).
RUN corepack enable

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host"]