# Camp Glowstick TURN relay

This directory is the production path for WebRTC relay support when direct peer-to-peer connectivity fails.

## Deploy

1. Provision a small public Linux VM with a stable public IP and DNS name.
2. Copy `.env.example` to `.env` and replace every example value.
3. Open UDP/TCP 3478, TCP 5349, and UDP 49160-49200 in the host/cloud firewall.
4. Run `docker compose up -d` from this directory.
5. Set the GitHub Actions repository values used by the Pages build:
   - `VITE_TURN_URL=turn:YOUR_HOST:3478?transport=udp`
   - `VITE_TURN_USER` as the configured TURN user
   - `VITE_TURN_PASS` as the configured TURN password
6. Redeploy `main` and verify a browser pair can connect while one side is on a restrictive/NATed network.

The client already reads these values in `src/net/config.ts` and appends the relay to its ICE server list. Do not commit a real TURN password to this repository.

## Production hardening

For an internet-facing deployment, prefer TLS (`turns:` on 5349), a real certificate, rate limits, monitoring, and time-limited credentials rather than a permanent shared password. The checked-in stack is deliberately small and reproducible; production credentials and the public relay itself remain deployment-time infrastructure rather than source-controlled secrets.
