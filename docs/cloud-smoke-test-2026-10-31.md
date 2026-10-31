# Cloud capability probe 2026-10-31

| Check | Result |
|---|---|
| api.github.com | 200 |
| github.com | 400 |
| registry.npmjs.org | 200 |
| pypi.org/simple/pip | 200 |
| crates.io serde API | 403 |
| deb.debian.org | blocked (proxy CONNECT 403) |
| proxy.golang.org | 200 |
| example.com | blocked (proxy CONNECT 403) |
| www.bbc.co.uk | blocked (proxy CONNECT 403) |
| npm view express version | worked (5.3.0) |
| pip download requests | worked |
| apt-get install shellcheck | failed (package not found) |
| node | v22.23.4 |
| python3 | 3.11.18 |
| go | go1.24.7 linux/amd64 |
| cargo | 1.97.0 |
| hugo | missing |
| shellcheck | missing |
| WebSearch | yes, results returned (2 result sets, ~30 links; none relevant to Tankmate) |
| WebFetch bbc.co.uk/news | no (blocked by tool) |

Created by an unattended cloud routine on 2026-10-31; safe to delete.
