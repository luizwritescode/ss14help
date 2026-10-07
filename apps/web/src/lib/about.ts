/** Project links and licensing shown in the About dialog. Mirrors LICENSE and ATTRIBUTION.md. */

export const REPO_URL = "https://github.com/luizwritescode/ss14help";
export const LICENSE_URL = `${REPO_URL}/blob/HEAD/LICENSE`;
export const ATTRIBUTION_URL = `${REPO_URL}/blob/HEAD/ATTRIBUTION.md`;
export const ISSUES_URL = `${REPO_URL}/issues`;

export const CODE_LICENSE = "MIT";
export const COPYRIGHT = "© 2024–2026 Luiz Henrique Costa";

/**
 * License of each server's game data, by server id. When adding a server to servers.yaml, add
 * an entry here and a row in ATTRIBUTION.md. Servers without an entry point to their repository.
 */
export const DATA_LICENSES: Record<string, string> = {
  upstream: "MIT (code and prototypes). Assets are mostly CC-BY-SA 3.0, see the repository.",
  starlight:
    "MIT for current contributions. Contributions from 2024-11-04 to 2026-02-28 are under the " +
    "Starlight License, a modified MIT license that requires attributing the Starlight project " +
    "and linking its repository (LICENSE-Starlight.TXT there). Content ported from other forks " +
    "keeps the licenses listed in the Starlight repository.",
};
