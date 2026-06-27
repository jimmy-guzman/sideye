import { upgradeInvocation } from "./commands";
import { classifyInstall } from "./install-method";

const unknownGuidance = `could not determine how sideye was installed. upgrade with one of:
  curl -fsSL https://raw.githubusercontent.com/jimmy-guzman/sideye/main/install.sh | bash
  npm i -g sideye@latest
  brew upgrade jimmy-guzman/tap/sideye`;

/**
 * Self-updates sideye to the latest release via the channel it was installed through. Runs before
 * the TUI (like --help/--version) and spawns with inherited stdio so the user sees the underlying
 * curl/npm/brew progress live; that is why it uses Bun.spawn directly rather than the Process
 * service, the same documented exception EditorLive relies on. Returns the exit code.
 */
export async function runUpgrade(input: { execPath: string }) {
  const invocation = upgradeInvocation(classifyInstall(input.execPath));

  if (invocation === undefined) {
    console.error(unknownGuidance);
    return 1;
  }

  console.log(invocation.label);
  const proc = Bun.spawn(invocation.argv, {
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });

  return await proc.exited;
}
