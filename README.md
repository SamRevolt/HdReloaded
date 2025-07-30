# HdReloaded (Personal Fork by SamRevolt)

> A lightweight tool to handle **LightGun feedback** (recoil, LEDs, haptics, etc.) for supported arcade games.  
> Fork of the original [node-game-outputs] project by **nugarp / spazzy**  
> Modified, extended, and maintained by **SamRevolt** since July 2025  
> License: CC-BY-NC-SA-4.0

---

## What is this?

**HdReloaded** is a personal fork of the project **node-game-outputs**, originally developed by **nugarp/spazzy**.  
This version continues their great work and introduces new improvements, additional game support, and modernized configuration options — all tailored to my personal use and shared for others who may find it useful.

> ⚠️ This tool is specifically designed to handle **LightGun output feedback** via serial devices (e.g. Gun4IR, Revolv) for supported arcade games.

This fork is **non-commercial** and fully credits the original authors, in compliance with the original license.

---

## Key Improvements in this Fork (by SamRevolt)

- New plugin system for additional games
- Enhanced logging with time-based diagnostics
- New support added for: *Cooper’s 9 Arcade* 2 players supports for Recoil & Rumble(damage) 

---

### Prerequisites

- Windows 10/11 (x64)
- Gun4IR device or any compatible serial interface
- Serial ports properly assigned in `config/config.json`

---

## Cooper's 9 - Installation Instructions

1. Unpack the files anywhere you like.  
2. Go to the installation directory.
3. Open the `config/config.json` file and make sure your COM ports are correctly assigned for your LightGun devices.    
4. Run the following command in a terminal:
  
   HdReloaded -target=konami -rom=coopers9

5. Launch *Cooper's 9* using **TeknoParrot** or **JConfig**, as you normally would.

---

### Note for LightGun Revolv users:

→ Replace the existing `device.js` file with the one provided in this package to ensure full compatibility and proper feedback handling.
