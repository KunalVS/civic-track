# CivicTrack Mobile App Plan

The mobile app is expected to be implemented in React Native. For the hackathon MVP, the backend contracts in this repository already support the mobile workflow.

## MVP Mobile Screens

- Login with mocked Aadhaar eKYC
- Check-in/check-out with GPS validation
- Current task list
- Geo-tagged proof upload
- Background tracking status
- Sync queue and retry status

## Implementation Notes

- Use foreground and background location permissions with clear consent text.
- Queue location pings locally when the network is unavailable and flush on reconnect.
- Enforce minimum tracking intervals from the backend socket config.
- Bind photo upload payloads with GPS coordinates and capture timestamp before sending.
- Use secure storage for JWTs and device identifiers.
- Keep a drift-warning banner when the device reports stale timestamps or low-accuracy GPS.
- Only allow proof upload when a fresh coordinate fix is available.

## Suggested React Native Modules

- `react-native-maps` or native location SDK for preview map
- `react-native-background-geolocation` or Expo alternatives
- `react-native-image-picker`
- `socket.io-client`
- `react-native-mmkv` or secure storage module for offline queue metadata
