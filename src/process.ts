export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

function commandFailedError(command: string[], result: CommandResult) {
  const rendered = command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ")
  const detail = result.stderr.trim() || result.stdout.trim()
  return new Error(`${rendered} failed with exit ${result.exitCode}${detail === "" ? "" : `\n${detail}`}`)
}

export function runCommand(command: string[], cwd: string, allowedExitCodes = [0], stdin?: string) {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    ...(stdin === undefined ? {} : { stdin: new Blob([stdin]) }),
    stdout: "pipe",
    stderr: "pipe",
  })

  const output: CommandResult = {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  }

  if (!allowedExitCodes.includes(output.exitCode)) {
    throw commandFailedError(command, output)
  }

  return output
}

export async function runCommandAsync(command: string[], cwd: string, allowedExitCodes = [0]) {
  const process = Bun.spawn({
    cmd: command,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])

  const result = { exitCode, stdout, stderr }

  if (!allowedExitCodes.includes(exitCode)) {
    throw commandFailedError(command, result)
  }

  return result
}
