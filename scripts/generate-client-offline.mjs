import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localRequire = createRequire(import.meta.url);
const generatorRequire = process.env.PRISMA_GENERATOR_DEPS
  ? createRequire(resolve(process.env.PRISMA_GENERATOR_DEPS, 'package.json'))
  : localRequire;
const expectedVersion = localRequire('prisma/package.json').version;

// An explicit fallback using Prisma's official internal API. It uses the
// npm-delivered WASM schema parser and TypeScript generator; no binary is faked,
// no checksum is ignored, and no database connection/migration is attempted.
// These internal packages must match the installed Prisma CLI version exactly.
for (const name of ['@prisma/internals', '@prisma/client-generator-registry']) {
  const version = JSON.parse(
    readFileSync(
      resolve(dirname(generatorRequire.resolve(name)), '..', 'package.json'),
      'utf8',
    ),
  ).version;
  if (version !== expectedVersion) {
    throw new Error(
      `${name} must match the installed Prisma version ${expectedVersion}.`,
    );
  }
}
const { getGenerators } = generatorRequire('@prisma/internals');
const { defaultRegistry } = generatorRequire(
  '@prisma/client-generator-registry',
);
const generators = await getGenerators({
  schemaPath: resolve(projectRoot, 'prisma/schema.prisma'),
  registry: defaultRegistry.toInternal(),
  skipDownload: true,
  cliCommand: 'prisma generate',
});
try {
  for (const generator of generators) {
    await generator.generate();
    console.log(
      `Generated ${generator.getPrettyName()} with Prisma ${expectedVersion}.`,
    );
  }
} finally {
  for (const generator of generators) generator.stop();
}
