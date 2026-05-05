import {
  addAlias,
  removeAlias,
  listAliases,
} from '../utils/providerProfiles.js'

/**
 * IO surface — abstracted so tests can inject buffers instead of touching
 * real process.stdout / process.exit.
 */
export type AliasCliIO = {
  stdout: (s: string) => void
  stderr: (s: string) => void
  exit: (code: number) => void
}

const realIO: AliasCliIO = {
  stdout: s => process.stdout.write(s),
  stderr: s => process.stderr.write(s),
  exit: code => process.exit(code),
}

export function runAliasAdd(
  name: string,
  modelId: string,
  io: AliasCliIO = realIO,
): void {
  const result = addAlias(name, modelId)
  if (!result.ok) {
    io.stderr(`error: ${result.error}\n`)
    io.exit(1)
    return
  }
  io.stdout(`added alias: ${name} → ${modelId}\n`)
}

export function runAliasRm(
  name: string,
  io: AliasCliIO = realIO,
): void {
  const result = removeAlias(name)
  if (!result.ok) {
    io.stderr(`error: ${result.error}\n`)
    io.exit(1)
    return
  }
  if (!result.removed) {
    io.stderr(`no alias named "${name}" on the active profile\n`)
    return
  }
  io.stdout(`removed alias: ${name}\n`)
}

export function runAliasList(
  opts: { json?: boolean },
  io: AliasCliIO = realIO,
): void {
  const result = listAliases()
  if (!result.ok) {
    io.stderr(`error: ${result.error}\n`)
    io.exit(1)
    return
  }
  if (opts.json) {
    io.stdout(JSON.stringify(result.entries, null, 2) + '\n')
    return
  }
  if (result.entries.length === 0) {
    io.stdout('(no aliases on the active profile)\n')
    return
  }
  for (const { name, model } of result.entries) {
    io.stdout(`${name} → ${model}\n`)
  }
}
