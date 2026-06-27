export type InstallMethod = "standalone" | "npm" | "brew" | "unknown";

/**
 * Classifies how the running binary was installed from its own path, so `upgrade` can defer to the
 * right channel. The npm launcher (script/sideye-launcher.cjs) spawns the compiled binary under
 * node_modules, so the running process's execPath carries that marker directly.
 */
export function classifyInstall(execPath: string): InstallMethod {
  if (execPath.includes("/Cellar/") || execPath.includes("/homebrew/")) {
    return "brew";
  }

  if (execPath.includes("/node_modules/")) {
    return "npm";
  }

  if (execPath.includes("/.sideye/bin/") || execPath.includes("/.local/bin/")) {
    return "standalone";
  }

  return "unknown";
}
