// example generic code that gets called for each controller ("player") after a connected event
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
// EXAMPLE:
// based on which game is launched, I might want to send the guns to 4:3
// uncomment this code:
//
console.log(data);
switch(data.key) {
   case 'ptblank':
       player.sendAction("S0&o2.43&"); // basculer le mode de visée en 4/3
	   break;
   case 'ptblank2':
       player.sendAction("S0&o2.43&"); // basculer le mode de visée en 4/3
       break;
   case 'lamachin':
       player.sendAction("S0&o2.43&"); // basculer le mode de visée en 4/3
       break;
   case 'duckhunt':
       player.sendAction("S0&o2.43&"); // basculer le mode de visée en 4/3
       break;
   case 'bang':
       player.sendAction("S0&o2.43&"); // basculer le mode de visée en 4/3
       break;
   case 'timecris':
	   player.sendAction("S0&o2.43&");
//    case 'tc5':
//    case 'notepad':
//        player.sendAction("M3.0");
//        break;
}