// example generic code that gets called for each controller ("player") after an unhook event, before the controllers are disconnected
// more example code is available in connected.js
//
// data object contains: 
// data.key (helps identify the game as defined in config.json)
// data.player (1-N)
// data.port (COMx)
// data.state (CONNECTED, ERROR, DISCONNECTING, DISCONNECTED)
//
// player has specific functions, but you will likely only need:
// player.sendAction("MySerialCode");
//
// assume that my front-end is 16:9 and I always want to reset to 16:9 after a game quits:
//
// uncomment this code:
player.sendAction("o2.169&"); //retablir la visee 16/9
player.sendAction("E&"); //quitter le mode serial command