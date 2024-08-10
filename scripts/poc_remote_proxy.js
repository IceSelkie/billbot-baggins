https = require('https');os = require("os");fs = require("fs");WebSocket = require('ws');
DEBUG = true;

// Proxy will connect to hanab.live
// It will initialize games on "init" dispatches
// It will keep the game state updated with "" and ""
// It will ask for plays when it is our turn
// It will end games on ""
// It will ignore all else (directives to join tables and respond to commands should be handled elsewhere)


class RemoteProxy {
  constructor(token) {
    this.welcome = null;
    this.tableID = null;
    this.usersToTables = new Map();
    this.commandingUser = null;
    this.gameState = null;
    this.warningsRateLimit = [];

    if (!token) throw new Error("There is no passed token!");
    this.ws = new WebSocket('wss://hanab.live/ws', {headers:{Cookie:token}});
    this.ws.on("open", function open(){console.log("Connected...")});
    this.ws.on("close", function close(code,reason){console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`)});
    this.ws.on("error", function error(err){console.error(`WebSocket error. Code: ${err.code}, Message: ${err.message}`)});
    this.send=(type,json)=>{
      if (this.ws.readyState !== WebSocket.OPEN) console.error("WebSocket is not open. Cannot send message.");
      if (json) type = type+" "+JSON.stringify(json);
      if (DEBUG) console.log(new Date(),"~>",type);
      this.ws.send(type);
    };
    this.ws.on("message",(data)=>{let ind=data.indexOf(" ");try{this.onDispatch(data.slice(0,ind).toString(),JSON.parse(data.slice(ind)))}catch(e){console.error(e);}});
  }
  onDispatch(type, data) {
    if (DEBUG) console.log(new Date(),"<~",type, JSON.stringify(data).slice(0,120));

    // Data keeping
    if (type === "userList")
      data.forEach(user=>this.usersToTables.set(user.name,user.tableID));
    if (type === "user")
      this.usersToTables.set(data.name,data.tableID);
    if (type === "table" && (data.players.includes(this.welcome.username) || data.spectators.find(spec=>spec.name===this.welcome.username)))
      this.tableID = data.id;
    if (type === "welcome" && data.playingAtTables.length>0)
      this.send("tableReattend",{tableID:(this.tableID = data.playingAtTables[0])});
    if (type === "welcome")
      { this.welcome = data; console.log(`Logged in as ${data.username}.`); }


    // Logistics (Connecting to a game)
    if (type === "tableStart")
      this.send("getGameInfo1",{tableID:(this.tableID=data.tableID)});
    if (type === "init")
      { this.send("getGameInfo2",{tableID:this.tableID}); }
    if (type === "gameActionList")
      this.send("loaded",{tableID:this.tableID});
    if (type === "boot" || type === "left")
      { this.tableID=null; this.gameState=null; }
    if (type === "chat" && data.msg[0]==="/") // && data.recipient===this.welcome.username)
      this.handleCommand(data);
    if (type === "warning" && this.tableID && !data.warning.startsWith("You are not playing or spectating at"))
      this.send("chat",{msg:`Warning: ${JSON.stringify(data.warning)}`,room:`table${this.tableID}`});
    if (type === "warning" && this.commandingUser && !data.warning.endsWith(" is not currently online."))
      this.send("chatPM",{msg:`Warning: ${JSON.stringify(data.warning)}`,recipient:this.commandingUser});
    if (type === "warning") {
      let now = new Date();
      this.warningsRateLimit.push(now);
      this.warningsRateLimit = this.warningsRateLimit.filter(a=>a>now-10000);
      if (this.warningsRateLimit.length >= 10) {
        console.error(`${this.warningsRateLimit.length} errors in ${(now-this.warningsRateLimit[0])/1000}s: Crashing...`);
        this.ws.close(1000); process.exit(0);
      }
    }

    // Within a game
    if (type === "init")
      { this.gameState = this.createGameState(data); console.log(`Initializing game with ${data.hasCustomSeed?"custom seed":"seed"} ${JSON.stringify(data.seed)}.`); }
    if (type === "gameAction")
      this.gameState.serverAction(data.action);
    if (type === "gameActionList")
      this.gameState.serverActionList(data.list);
  }
  handleCommand({msg, who, recipient}) {
    // Set commander from PMs only.
    if (recipient) this.commandingUser = who;
    
    let message = msg.split(" ");
    if (message[0] === "/join" || message[0] === "/joinall")
      this.send("tableJoin",{tableID:this.usersToTables.get(who),password:message.slice(1).join(" ")});
    if (message[0] === "/leave" || message[0] === "/leaveall")
      this.send("tableLeave",{tableID:this.tableID});
    if (message[0] === "/s" || message[0] === "/start")
      this.send("tableStart",{tableID:this.tableID});
    if (message[0] === "/vtt" || message[0] === "/vttall")
      this.send("tableVoteForTermination",{tableID:this.tableID});
    if (message[0] === "/terminate")
      this.send("tableTerminate",{tableID:this.tableID});
    if (message[0] === "/rejoin") {
      this.send("tableUnattend",{tableID:this.tableID});
      this.send("tableReattend",{tableID:this.tableID});
    }
  }
  createGameState(init) {
    const gameState = new GameState(init.options.variantName, init.playerNames, init.ourPlayerIndex);
    gameState.clientPlay=(order)=>{this.send("action",{tableID:this.tableID,type:0,target:order});}
    gameState.clientDiscard=(order)=>{this.send("action",{tableID:this.tableID,type:1,target:order});}
    gameState.clientClueColor=(playerIndex,color)=>{this.send("action",{tableID:this.tableID,type:2,target:playerIndex,value:color});}
    gameState.clientClueRank=(playerIndex,rank)=>{this.send("action",{tableID:this.tableID,type:3,target:playerIndex,value:rank});}
    gameState.ai = new CoxAI(gameState);
    return gameState;
  }
}

RemoteProxy;