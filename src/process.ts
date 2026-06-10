export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export function runCommand(command: string[], cwd: string, allowedExitCodes = [0]) {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const output: CommandResult = {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  }

  if (!allowedExitCodes.includes(output.exitCode)) {
    const rendered = command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ")
    const detail = output.stderr.trim() || output.stdout.trim()
    throw new Error(`${rendered} failed with exit ${output.exitCode}${detail === "" ? "" : `\n${detail}`}`)
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
    const rendered = command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ")
    const detail = stderr.trim() || stdout.trim()
    throw new Error(`${rendered} failed with exit ${exitCode}${detail === "" ? "" : `\n${detail}`}`)
  }

  return result
}
