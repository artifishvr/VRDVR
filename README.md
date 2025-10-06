# DVR for VRCDN

(or rather, for saving DJ sets from VRChat events)

## Repo structure

- `cap/` - Barebones script for tailing vrchat logs and sending off URLs to the server (Bun/TS)
- `dvr/` - Server for recording and processing streams (Bun/TS)
- `web/` - Web interface (dvr.vrc.bz) (SvelteKit/TS)
