# DVR for VRCDN

(or rather, for saving DJ sets from VRChat events)

## Repo structure

- `cap/` ([Readme](cap/README.md)) - Barebones script for tailing vrchat logs and sending off URLs to the server (Go)
- `dvr/` - Server for recording and processing streams (Bun/TS)
- `web/` - Web interface ([dvr.vrc.bz](https://dvr.vrc.bz)) (SvelteKit/TS)
