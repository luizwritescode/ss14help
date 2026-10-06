# Attribution

ss14help is an unofficial fan project. It is not affiliated with or endorsed by the Space Wizards
Federation or any server listed below.

The recipe, reagent and localization data in `data/` is generated from game prototype files
(`Resources/Prototypes`, `Resources/Locale`) in the repositories below. That data stays under the
license of the repository it came from. Each snapshot's `manifest.json` records the exact repository
and commit it was built from.

| Server                  | Source repository                                                                   | License                                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wizard's Den (upstream) | [space-wizards/space-station-14](https://github.com/space-wizards/space-station-14) | MIT (code and prototypes); assets are mostly CC-BY-SA 3.0, see the repo                                                                                                                                                                                          |
| Starlight               | [ss14Starlight/space-station-14](https://github.com/ss14Starlight/space-station-14) | MIT for current contributions. Contributions from 2024-11-04 to 2026-02-28 are under the _Starlight License_, a modified MIT license that requires attributing the Starlight project and linking the repository above. See `LICENSE-Starlight.TXT` in that repo. |

Starlight also includes content ported from other forks (folders such as `_Mono`, `_FarHorizons`,
`_Funkystation`, `DeltaV`, …), whose licenses are listed in the Starlight repository.

When adding a server to `servers.yaml`, add a row here and check that server's license terms.

ss14help's own code (everything outside `data/`) is MIT licensed, see [LICENSE](LICENSE).
