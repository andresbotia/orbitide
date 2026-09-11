# Pixel Arcadia — TestFlight Beta Testing Guide (M4C.13)

**Build Information:**
- **App Name:** Pixel Arcadia
- **Bundle ID:** `com.andresbotia.orbitide`
- **Version:** `0.1.0`
- **Build Number:** `2`
- **Target Audience:** Internal Beta (3 testers: Andres + 2 friends)

---

## Tester Quickstart Guide

1. **Install Apple TestFlight** from the iOS App Store.
2. Accept your email invitation or redemption link for **Pixel Arcadia**.
3. Install the beta build (v0.1.0, Build 2).
4. Launch the app and confirm the custom app icon and splash screen appear smoothly.

---

## Practical Device Testing Checklist

### 1. App Lifecycle & Installation
- [ ] **Install & Launch:** Clean install from TestFlight. No crash on cold start.
- [ ] **Icon & Splash:** App icon rendered with proper contrast on iOS Home screen. Dark starry splash screen transitions smoothly into the title screen.
- [ ] **Orientation Lock:** Stays firmly locked in Portrait on iPhone; no visual glitches if rotating device.

### 2. Home & Campaign Navigation
- [ ] **Home Screen:** Title, world preview, and "RESUME" / "START" activation feel snappy and tactile.
- [ ] **World Select:** Tapping the world card transitions to Sector Map. Smooth scrolling across all 10 worlds with safe-area clearance at the bottom.
- [ ] **Level Select (10-node grid):** Clear indication of cleared levels (✓), current level (glowing ring), and locked levels.
- [ ] **Revisiting Worlds:** Verify you can replay any completed level from earlier worlds.

### 3. Core Gameplay & Spatial Physics
- [ ] **Launch Tunnels:** Tapping an active tunnel launches a pixel smoothly towards the ring orbit.
- [ ] **Holding Tray:** Tapping an unlaunched tunnel while holding space is available places a charge into the tray.
- [ ] **Held Relaunch:** Tapping a held pixel in the tray relaunches it into the orbital ring.
- [ ] **Multi-Charge Concurrency:** Rapid consecutive taps launch 2–5 concurrent active charges without stutter or trajectory collisions.
- [ ] **Orbit & Targeting Direction:** Charges orbit counter-clockwise (right-to-left) and peel off towards their matched target pixel on the board cleanly.
- [ ] **Spatial Origin:** Verify projectiles visually originate from the actual charge location, not an arbitrary offset.

### 4. Modifier Visuals & Clarity
- [ ] **Frozen Pixels (World 3+):** Cracked ice texture is clearly visible; first hit shatters ice, second hit clears pixel.
- [ ] **Shielded Pixels (World 5+):** Concentric barrier ring is obvious without depending on color; absorbs 1 hit of matched color, second hit clears.
- [ ] **Linked Pixels (World 8+):** Connected pips and paired highlights clearly signal linked destruction.

### 5. Feel & Polish
- [ ] **Haptics:** Subtle haptic feedback fires on taps, hits, and world clears.
- [ ] **Touch Responsiveness:** Instant response on tunnel taps; no input lag.
- [ ] **Safe Areas & Layout:** HUD elements avoid dynamic island / notch; bottom toolbar and tray remain well above the home indicator.
- [ ] **Text Hierarchy & Labels:** Single-line tutorial callouts; crisp typography on compact and large screens.

### 6. Game Loop & Progression
- [ ] **Level Clear (Win):** Completing the board reveals the restored pixel artwork, glowing discovery label, and victory sound/haptic.
- [ ] **Continue CTA:** Tapping "CONTINUE" proceeds to the next level.
- [ ] **Level Fail:** Overflowing holding capacity displays "HOLDING FULL" with clean dialog contrast and functional "RETRY" CTA.
- [ ] **Progress Persistence:** Closing and reopening the app preserves your highest unlocked level and cleared status.

---

## How to Report Bugs

When reporting an issue, please note:
1. **Level Number** (e.g., Level 21, Level 45)
2. **What Happened** (e.g., "Charge orbited twice before peeling off", "Text clipped")
3. **Screenshot / Screen Recording** (using iOS built-in screen capture)
4. **Device Model & iOS Version** (e.g., iPhone 15 Pro, iOS 18.1)
5. **Is it Reproducible?** (Always / Once / Intermittent)
