https = require('https');os = require("os");fs = require("fs");WebSocket = require('ws');
DEBUG = true;

// Proxy will connect to hanab.live
// It will initialize games on "init" dispatches
// It will keep the game state updated with "gameAction" and "gameActionList"
// It will ask for plays when it is our turn
// It will end games on "gameOver"
// It will also manage the bot and coordinate joining, spectating, and starting games.


class RemoteProxy {
  constructor(token) {
    this.welcome = null;
    this.tableID = null;
    this.usersToTables = new Map();
    this.commandingUser = null;
    this.gameState = null;
    this.warningsRateLimit = [];
    this.timer = {};

    if (!token) throw new Error("There is no passed token!");
    this.ws = new WebSocket('wss://hanab.live/ws', {headers:{Cookie:token}});
    this.ws.on("open", function open(){console.log("Connected...")});
    this.ws.on("close", function close(code,reason){console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`)});
    this.ws.on("error", function error(err){
      if (err.code === 401)
        throw new Error("Unathenticated error. Probably the token has expired or is invalid.");
      console.error(`WebSocket error. Code: ${err.code}, Message: ${err.message}`);
    });
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
      { this.gameState = this.createGameState(data); console.log(`Initializing game with ${data.hasCustomSeed?"custom seed":"seed"} ${JSON.stringify(data.seed)}.`); 
        this.timer = {myTurn:0n, thinking:0n, gameTime:-process.hrtime.bigint()}; }
    if (type === "gameAction")
      this.serverAction(data.action);
    if (type === "gameActionList")
      this.serverActionList(data.list);
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
    if (message[0] === "/rejoin" || message[0] === "/reattend" || message[0] === "/attend") {
      this.send("tableUnattend",{tableID:this.tableID});
      this.send("tableReattend",{tableID:this.tableID});
    }
    if (message[0] === "/spectate")
      this.send("tableSpectate",{tableID:this.usersToTables.get(who),shadowingPlayerIndex:Number(message[1]??-1)});
    if (message[0] === "/unattend")
      { this.send("tableUnattend",{tableID:this.tableID}); this.tableID=null; this.gameState=null; }
    if (message[0] === "/restart")
      this.send("tableRestart",{tableID:this.tableID,hidePregame:false});

    if (message[0] === "/timer" || message[0] === "/timing")
      this.send("chat",{msg:`Game Duration: ${Math.round(Number(proxy.timer.gameTime??0n)/1e5)/1e4}s, Decisionmaking on my turn: ${Math.round(Number(proxy.timer.myTurn??0n)/1e4)/1e6}s, Time considering other players' moves: ${Math.round(Number(proxy.timer.thinking??0n)/1e5)/1e4}s, `,room:`table${this.tableID}`});
  }
  createGameState(init) {
    const gameState = new GameState(init.options.variantName, init.playerNames, init.ourPlayerIndex);
    if (init.ourPlayerIndex != init.playerNames.indexOf(this.welcome.username)) {
      console.error("Our player index does not match our name index!",JSON.stringify({ourPlayerIndex:init.ourPlayerIndex,myName:this.welcome.username,playerNames:init.playerNames}));
      gameState.shouldPlay = false;
    }
    gameState.clientPlay=(order)=>{this.send("action",{tableID:this.tableID,type:0,target:order});}
    gameState.clientDiscard=(order)=>{this.send("action",{tableID:this.tableID,type:1,target:order});}
    gameState.clientClue=({playerIndex,colorIndex,rank})=>colorIndex!==undefined?gameState.clientClueColor(playerIndex,colorIndex):gameState.clientClueRank(playerIndex,rank);
    gameState.clientClueColor=(playerIndex,color)=>{this.send("action",{tableID:this.tableID,type:2,target:playerIndex,value:Number(color)});}
    gameState.clientClueRank=(playerIndex,rank)=>{this.send("action",{tableID:this.tableID,type:3,target:playerIndex,value:Number(rank)});}
    gameState.ai = new CoxAI(gameState);
    gameState.actionListReceived = false;
    gameState.actionQueue = [];
    return gameState;
  }
  serverAction(action, bypass=false){
    if (!this.gameState.actionListReceived && !bypass) {
      this.gameState.actionQueue.push(action);
      return;
    }

    this.timer.thinking -= process.hrtime.bigint();
    if (action.type==="draw")
      this.gameState.serverDraw(action);
    if (action.type==="play")
      this.gameState.serverPlay(action);
    if (action.type==="clue")
      this.gameState.serverClue(action);
    if (action.type==="discard")
      this.gameState.serverDiscard(action);
    if (action.type==="strike")
      this.gameState.serverStrike(action);

    if (action.type==="status")
    //   this.gameState.serverStatus(action);
      console.log(`Current state:`,JSON.stringify({turn:this.gameState.turn, tokens:this.gameState.tokens, strikes:this.gameState.strikes, playable:bits(this.gameState.playable), trash:bits(this.gameState.trash), playPile:this.gameState.playPile.map(a=>a?.length), discardPile:this.gameState.discardPile.length,hands:this.gameState.hands.map(hand=>hand.map(c=>bits(c.public)))}));
    if (action.type==="gameOver") {
      this.gameState.serverGameOver(action);
      this.timer.gameTime += process.hrtime.bigint();
    }
    if (action.type==="turn")
      this.gameState.serverTurn(action);

    this.timer.thinking += process.hrtime.bigint();
  }
  serverActionList(actionList) {
    const shouldPlay = this.gameState.shouldPlay;
    this.gameState.shouldPlay = false;
    // console.log("Reading an action list. Should not play.",{shouldPlay,gameStateShouldPlay:this.gameState.shouldPlay});
    actionList.forEach((action,i)=>{
      // console.log(`Loading action ${i} of ${actionList.length}).`);
      // reenable actions on last action
      if (i == actionList.length-1) {
        this.gameState.shouldPlay = shouldPlay;
        // console.log(`Reached end of action list (${i} of ${actionList.length}). Resume playing to prior state.`,{gameStateShouldPlay:this.gameState.shouldPlay});
      }
      this.serverAction(action, true);
    });
    this.gameState.actionListReceived = true;
    this.gameState.actionQueue.forEach(action=>this.serverAction(action));
    this.gameState.actionQueue = null;
  }
}

RemoteProxy;
