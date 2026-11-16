import { execFileSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const APP_PATH = process.cwd();
const CONFIG_DIR = path.join(os.homedir(), '.twenty');
// CLI 2.58 читает только этот файл (в 2.37 приложение тестов читало config.test.json)
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const CLI_PATH = path.join(APP_PATH, 'node_modules', '.bin', 'twenty');

function validateEnv(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      'TWENTY_API_URL and TWENTY_API_KEY must be set.\n' +
        'Or set them in vitest env config.',
    );
  }

  return { apiUrl, apiKey };
}

async function checkServer(apiUrl: string) {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/healthz`);
  } catch {
    throw new Error(
      `Twenty server is not reachable at ${apiUrl}. ` +
        'Make sure the server is running before executing integration tests.',
    );
  }

  if (!response.ok) {
    throw new Error(`Server at ${apiUrl} returned ${response.status}`);
  }
}

function writeConfig(apiUrl: string, apiKey: string) {
  const payload = JSON.stringify(
    {
      remotes: {
        local: { apiUrl, accessToken: apiKey },
      },
      defaultRemote: 'local',
    },
    null,
    2,
  );

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, payload);
}

// Программного API у CLI 2.58 нет (twenty-sdk/cli удалён) — зовём бинарник.
function runCli(args: string[], allowFailure = false) {
  try {
    execFileSync(CLI_PATH, args, { cwd: APP_PATH, stdio: 'inherit' });
  } catch (error) {
    if (allowFailure) {
      return false;
    }

    throw error;
  }

  return true;
}

export async function setup() {
  const { apiUrl, apiKey } = validateEnv();

  await checkServer(apiUrl);

  writeConfig(apiUrl, apiKey);

  runCli(['app', 'uninstall', '--yes'], true);

  runCli(['app', 'apply', '--create', '--yes']);
}

export async function teardown() {
  const ok = runCli(['app', 'uninstall', '--yes'], true);

  if (!ok) {
    console.warn('App uninstall failed');
  }
}
