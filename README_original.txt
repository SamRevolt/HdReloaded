> 📄 This is the original README from the project "node-game-outputs" by nugarp / spazzy.  
> It has been preserved unmodified as part of this personal branch by SamRevolt.

HDRecoil / node-game-ouputs by spazzy/nugarp, v0.2.0b.
A platform for real good feedback for your Gun4IR (and potentially http) devices.
Last Updated 03/06/2024.

** EDIT CONFIG/CONFIG.JSON TO PUT YOUR GUN4IR'S SERIAL PORT #S IN THERE AT THE VERY MINIMUM. YOUR GUNS SHOULD VIBRATE FOR 200MS UPON GAME LAUNCH IF THIS TOOL HAS DETECTED THEM. You can turn that off in config.json (rumbleOnHook). **

node-game-outputs is a tool for sending game outputs, either by memory reading or by mamehooker outputs, to your GUN4IR (and potentially other) output devices. Examples included are for GUN4IR only. You will need to update config.js, which determines which apps should use which plugins, and defines which ports your GUN4IR devices are on.

It provides a lot more flexibilty to achieve nicer, high-level effects (such as rumble fades) with minimal code. You are also able to take game state into account when creating your own code, and can customize the outputs just as you would like.

node-game-outputs also relies on some high accuracy timers thanks to the NanoTimer class developed for javascript. This class is accurate to within fractions of a millisecond - along with the updated parameters that this sofware has already wrapped up, this accuracy allows for very consistent rapid fire recoil (solenoid) pulses. I would recommend a PC with a GOOD cpu for the best accuracy. I have only tested this on an AMD 5600X and I5-12400F.

How to use:

14 example plugins included to show you the range of ways you can detect and create recoil effects.
This list of plugins can be used for many, many more games via generic handling plugins.
The 14 included plugins are:

- 5 that directly read game memory
-- House of the Dead 4 (tested with TP, outputs don't need to be enabled)
-- Jurassic Park Arcade (TP)
-- Terminator Salvation (TP)
-- Time Crisis 5 (recommend running with TP, outputs don't need to be enabled though, see notes in js file) ** You may need to enable the prelaunch option **
-- The Lost World (model 3 - the game has no outputs so we create them ourselves!)

- 2 WIP/beta plugins (that read game memory)
-- Point Blank for MAME (it may take some time for it to be able to find the addresses for firing, but once it is hooked, it will work)
-- Deadstorm Pirates (Arcade) for RPCS357/Project Omed (rpcs3-gun.exe, needs further testing)

- 6 that use MAMEHooker outputs
-- LA Machineguns uses model 3's native outputs engine (run supermodel.exe with -outputs=win)
-- Transformers Human Alliance uses DemulShooter's outputs (if you don't want DS for inputs, run DS with -noinput)
-- Operation GHOST uses TP/Output Blaster's outputs
-- Let's Go Island 3D uses TP/Output Blaster's outputs
-- Rabbids Hollywood Arcade uses DemulShooter's custom outputs (game has no native recoil)
-- As above, you can use either of 2 "Generic" Mamehooker output handlers via Demulshooter's outputs to run (run DemulShooter with -noinput if you don't need DS's inputs):
--- Confidential Mission (although demulshooter has the wrong output address for p2 ammo)
--- House of the Dead
--- House of the Dead 2
--- House of the Dead SD (untested)
--- Sega Golden Gun
--- Virtua Cop 2
--- Virtua Cop 3 (In theory, but I couldn't get this to work)
--- Gunblade NY
--- (you can add more that use the generic demulshooter plugin by adding the romname to config/config.json)
---- For using DS's custom outputs, use demulshooter-custom.js, for generic outputs, use demulshooter-generic.js
---- To leverage Demulshooter's outputs, all you literally have to do is pick which outputs file you want and
---- add an entry to the config.json file so this software can recognize which plugin to use and detect when the game is
---- launched.

- 1 plugin for testing your setup
-- Open Notepad and see if your gun(s) rumble.

Feel free to keep node-game-outputs running in the background. It should support multiple game launches/exits. It will only launch its feedback effects for games defined in config/config.json.

For games that use MAMEHooker outputs, you will need to run the Mame->SocketIO Interop tool (in a subdirectory). You can run it before or after running node-game-outputs. It will work either way. If the icon is red, nothing is connected to the tool. Yellow means it is connected to either node-game-outputs or a mamehooker output source. Green means both ends have been connected. You can double click the system tray icon to view a history of mamehooker received commands. Run games after both tools are ready. If your games run as admin, all of the included tools should be run as admin. However, these tools do not require admin permissions if the games are not as admin. If you notice wonky behavior, try re-running the interop exe or node-game-outputs and see if it fixes the issue.

Note: nothing is stopping you from running MAMEHooker side-by-side with this software. You cannot write to the same serial port in both (i.e. both cannot interface with COM1) but if you have an LEDWiz or other device, and the software you are leveraging uses MAMEHooker outputs, you can put the commands for LEDWiz in MAMEHooker and keep that running.

Prerequisites:
- node.js. I tested with v14.17.0, 64bit on Win 10 x64. https://nodejs.org/en/download/ 
-- VERY IMPORTANT: check the checkbox at installation that asks if you want to install build tools for C/C++. You do!
- after installing node, run install.bat
- after running install.bat, run start.bat. start.bat will run both the interop and the actual node-game-outputs plugin software.

How to override behavior on a per-game COM connection/disconnect:
- In the /overrides/connected/ or /overrides/disconnecting/ folders, you can place a file with a game's key (see "key" param in config.json)
- The js file will execute at the appropriate time. You will have access to two variables: player and data.
- player is an object you can manipulate to communicate with your device:
- To send a COM command, just write: player.sendAction("MySerialCommand");
- data contains pertinent information such as Player # (1-indexed), COM port, connected state, and key

Changelog:
v0.3.0 - 03/06/2024
HDRecoil:
• HDRecoil updated to a portable application based on "hd-recoil-node-game-outputs-0.2.0b.zip"
• Node.js v20.14.0 (LTS) prebuilt binary included (https://nodejs.org/dist/v20.14.0/node-v20.14.0-win-x64.zip)
• Updated version number in package.json:
  ◦ "version": "0.3.0"
• Updated dependency versions in package.json:
  ◦ axios: v0.27.2 to v1.7.2
  ◦ decache: v4.6.1 to v4.6.2
  ◦ edge-js: v20.10.2 to v20.14.0
  ◦ lodash: v4.17.21 to [unchanged]
  ◦ md5-file: v5.0.0 to [unchanged]
  ◦ memoryjs: v3.5.1 to "file:./custom_node_modules/memoryjs",
  ◦ nanotimer: v0.3.15 to [unchanged]
  ◦ serialport: v10.4.0 to 12.0.0
  ◦ socket.io: v4.5.2 to 4.7.5
• Created AutoHotkey v2.0 scripts:
  ◦ install.ahk 
  ◦ start_hidden.ahk
  ◦ start_minimized.ahk
• Removed batch files:
  ◦ install.bat
  ◦ start.bat
  ◦ start_minimized.bat
• Removed memHelpers64.log.txt file
• Updated the "Last Updated" in the README.txt

Custom-built memoryjs node module:
After applying the following fixes, 'npm install --legacy-peer-deps' was executed:
• Updated dependency versions in package.json:
  ◦ eslin: v8.5.0 to v9.4.0
  ◦ eslint-config-airbnb-base: v12.1.0 to v15.0.0
  ◦ node-addon-api: v3.2.1 to v8.0.0
• Updated scripts in package.json to remove the the following as it requires "visualstudio2022-workload-vctools":
  ◦ "install": "npm run build",
  ◦ "build": "node ./scripts/install.js",
  ◦ "build32": "node-gyp clean configure build --arch=ia32",
  ◦ "build64": "node-gyp clean configure build --arch=x64",
  ◦ "buildtest": "cd test && MSBuild.exe project.sln //p:Configuration=Release",
  ◦ "debug": "node ./scripts/debug.js",
  ◦ "debug32": "node-gyp configure rebuild --debug --arch=xia32",
  ◦ "debug64": "node-gyp configure rebuild --debug --arch=x64"
• Updated scripts in package.json to include install so that the HDRecoil gets the dependencies:
  ◦ "install": "node ./scripts/install.js"
• Fixed build script issues in "install.js" due to Node.js security patch (https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2/):
  ◦ const child = spawn(program, args, { stdio: 'inherit', shell:true });
• Fixed type mismatch errors, char* to const char* and char** to const char** in:
  ◦ debugger.cc
  ◦ dll.h
  ◦ functions.h
  ◦ memoryjs.cc
  ◦ module.cc
  ◦ module.h
  ◦ process.cc
  ◦ process.h
TODO - Resolve Warnings:
C:\memoryjs\lib\functions.h(65,26): warning C4311: 'type cast': pointer truncation from 'LPVOID' to 'int' [C:\memoryjs\build\memoryjs.vcxproj]
  (compiling source file '../lib/memoryjs.cc')
  C:\memoryjs\lib\functions.h(65,26):
  the template instantiation context (the oldest one first) is
        C:\memoryjs\lib\memoryjs.cc(949,26):
        see reference to function template instantiation 'Call functions::call<int>(HANDLE,std::vector<functions::Arg,std::allocator<functions::Arg>>,functions::Type,DWORD64,const char **)' being compiled

C:\memoryjs\lib\functions.h(65,26): warning C4302: 'type cast': truncation from 'LPVOID' to 'int' [C:\memoryjs\build\memoryjs.vcxproj]
  (compiling source file '../lib/memoryjs.cc')

C:\memoryjs\lib\functions.h(116,24): warning C4311: 'type cast': pointer truncation from 'LPVOID' to 'DWORD' [C:\memoryjs\build\memoryjs.vcxproj]
  (compiling source file '../lib/memoryjs.cc')

C:\memoryjs\lib\functions.h(116,24): warning C4302: 'type cast': truncation from 'LPVOID' to 'DWORD' [C:\memoryjs\build\memoryjs.vcxproj]
  (compiling source file '../lib/memoryjs.cc')
v0.2.0b - 3/3/24
 Established a formal license for this software before public release: CC-BY-NC-SA-4.0
 - You are free to distribute it
 - You are free to alter it
 - Credit must be given to the original creator
 - You may not sell the software or any derivative
 - If in doubt, ask me - nugarp on BYOAC, Discord, & github.
v0.2.0 - 3/1/24
 A multitude of changes for this update:
 Re-engineered some of the core codebase, and adjusted the folder and file structure for clarity.
 Added pattern matching (point blank) and scanning for mapped memory (yuzu).
 Added webdevice plugin (mostly to consolidate the codebase between node-game-outputs for gun4ir vs leader lamps for racing).
 NO LONGER REQUIRES NODE v14.17.0. YOU CAN USE A NEWER VERSION. MAKE SURE TO RUN "npm install" from the dir of index.js in the command line.
 Added a larger selection of game plugins for a semi-public release (Terminator Salvation, Jurassic Park Arcade, Pt Blank X, RHA, TRA)
 Support for four guns.
 I am sure some new bugs that kind folks will let me know about.
v0.1.7b - 12/08/22
 Fixed bug with not re-gaining S6 access to a gun when using pre-connect upon actual hook.
 (Basically, the gun would act like default)
v0.1.7 - 12/07/22
 Added support for "quitAfterHook" config item, which will close program after all controllers have unhooked.
 Also added support for a generic /overrides/connected.js and /overrides/disconnecting.js file. This will run before
 game-specific connected/disconnecting javascript files (see v0.1.6 update note below).
v0.1.6 - 12/06/22
 Added support for external connected(player, data) and disconnecting(player, data) methods via /overrides/ folder.
 Also added support for "preconnect" flag which will reserve the GUN4IR COM ports immediately upon app start and only
   will release them upon final application exit (all other connect/disconnect logs are "dummy" logs).
v0.1.5 - 12/06/22
 Added support for disconnecting(player) method which can be handled by both regular and mamehooker plugins.
v0.1.4 - 12/05/22
 Added support for Rabbids Hollywood Arcade via DemulShooter's custom outputs. Changed overall refresh interval to 8ms. Added
 support for "dummy" controllers, so for example, if you want guns 1 and 2 to be 2 and 3 (i.e. 2 gun pedestal in a 4 gun game), you
 can do that. Dummy controllers may also help if you have fewer controllers than a plugin expects as not all plugins will work for
 systems with only one lightgun. Also improved error handling around COM connection issues with better debugging messages. Also
 added connected(player) method hook for regular and mamehooker plugins.
v0.1.3 - 10/06/22
 Added support for Lost World (Sega Model 3). This required a different library version of memoryjs and so you will need to run
 install.bat again after having replaced any old version of the software.
 Also updated the onUnhook code to handle even more race conditions, this time related to a game's gameDelay variable (i.e. TC5).
v0.1.2b - 10/04/22
 Updated readme file and included latest versions of all files and plugins. various bug fixes in various game plugins. more aggressive
 behavior when unhooking to try and prevent cases where rumble gets stuck.
v0.1.2 - 9/28/22
 Added generic plugin for DemulShooter - should work well for many games, many samples have been included in the config.json file
 Updated MAMEOutputsSocketIoInterOp.exe so it detects when a game process is closed (even force closed) and sends MAMEOutputStop appropriately. The implication being that you can now keep both the node process and this exe running 24/7 in the background and they will continue to detect games by themselves.
v0.1.1 - 9/26/22
 Added plugins for Operation GHOST (TP/Output Blaster), Let's Go Island 3D (TP/Output Blaster) and fixed P2 of LA Machineguns.
v0.1 - 9/25/22
 Initial release
