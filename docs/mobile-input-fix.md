# iPad/mobile input verification

This branch contains the post-PR #10 iPad input hardening pass.

Verify on real iPad Safari in landscape:

1. Touch-only: left stick moves continuously in all directions.
2. Touch-only: right-side drag rotates camera; a tap performs USE/interact.
3. Buttons: USE, JUMP, RUN, CROUCH, LIGHT, GLOW, MAP, DROP all respond.
4. Magic Keyboard: WASD moves; arrow keys look; trackpad drag looks; trackpad tap/click interacts.
5. Dragging to look must not accidentally pick up/throw an object on release.
6. Touch controls stay visible when a Magic Keyboard/trackpad is attached.

The implementation uses both Pointer Events and Touch Events because iPadOS/Safari behavior can vary with attached pointing devices.