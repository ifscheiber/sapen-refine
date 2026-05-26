import { readFileSync } from "node:fs";

export const DEPRECATED_PASSWORD_FLAG_WARNING =
  "Warning: --password is deprecated because command-line arguments can leak through shell history or process lists. Use a password file, environment variable, or --password-stdin instead.";

function stripOneFinalNewline(value) {
  return value.replace(/\r?\n$/, "");
}

function hasSecret(value) {
  return value !== undefined && value !== null && value !== "";
}

function readFileSecret(path, label) {
  try {
    return stripOneFinalNewline(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} could not be read: ${message}`);
  }
}

function readStdinSecret() {
  return stripOneFinalNewline(readFileSync(0, "utf8"));
}

export function markDeprecatedPasswordFlag(args, stderr = process.stderr) {
  args.deprecatedPasswordFlagUsed = true;
  stderr.write(`${DEPRECATED_PASSWORD_FLAG_WARNING}\n`);
}

export function resolveSecretInput(params) {
  const {
    cliPassword,
    cliPasswordFile,
    cliPasswordStdin,
    envPassword,
    envPasswordFile,
    envPasswordName,
    envPasswordFileName,
    secretDescription,
    fileReader = readFileSecret,
    stdinReader = readStdinSecret,
  } = params;

  const candidates = [
    cliPasswordFile
      ? {
          source: "--password-file",
          value: () => fileReader(cliPasswordFile, "--password-file"),
        }
      : null,
    hasSecret(envPasswordFile)
      ? {
          source: envPasswordFileName,
          value: () => fileReader(envPasswordFile, envPasswordFileName),
        }
      : null,
    hasSecret(envPassword)
      ? {
          source: envPasswordName,
          value: () => envPassword,
        }
      : null,
    cliPasswordStdin
      ? {
          source: "--password-stdin",
          value: stdinReader,
        }
      : null,
    hasSecret(cliPassword)
      ? {
          source: "--password",
          value: () => cliPassword,
        }
      : null,
  ].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error(
      `${secretDescription} is required. Use --password-file, ${envPasswordFileName}, ${envPasswordName}, --password-stdin, or deprecated --password.`,
    );
  }

  const selected = candidates[0];
  const secret = selected.value();
  if (!hasSecret(secret)) {
    throw new Error(`${secretDescription} from ${selected.source} must not be empty`);
  }

  return { secret, source: selected.source };
}
