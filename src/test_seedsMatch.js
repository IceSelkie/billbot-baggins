fs=require("fs");
LocalServer = require("./poc_local_server.js");

// Load data from wshistory/c*.json
data = [...new Set(
  // Select files "wshistory/c*.json"
  fs.readdirSync("wshistory").filter(a=>a.startsWith("c")&&a.endsWith(".json"))
  // Sort files from oldest to newest modify time
  .map(fname=>[fname,fs.statSync("wshistory/"+fname).mtime]).sort((a,b)=>a[1]-b[1]).map(a=>a[0])
  // Read and join the files together
  .flatMap(fname=>JSON.parse(fs.readFileSync("wshistory/"+fname)))
)] ; data.length;

// Find review game tuples
games = data.map((a,i)=>{
  // Find and extract each entry that contains consecutive entries of init, action list, and card identities.
  if(a.startsWith("init")&&data[i+1].startsWith("gameActionList")&&data[i+2].startsWith("cardIdentities"))
    return[a,data[i+1],data[i+2]];
}).filter(a=>a) ; games.length;
gamesbyname = games.map(a=>a.map((a,i)=>JSON.parse(a.slice(([5,15,15])[i])))).map(([{options,seed,databaseID},{list},{cardIdentities}])=>[options.variantName,{variant:options.variantName,databaseID:databaseID,seed,actions:list,cards:cardIdentities}]) ; gamesbyname.length;

let passed = [... new Set(gamesbyname.map(a=>[a[1].variant,a[1].seed,a[1].cards]).map(a=>{let dvari=v.find(b=>b.name===a[0]);let pred=LocalServer.shuffleDeckFromSeed(dvari,a[1]).join();let actual=a[2].map(c=>dvari.suits[c.suitIndex]+c.rank).join();return [dvari.id,a[1],actual===pred,actual,pred]}).filter(a=>a[2]).sort((a,b)=>a[0]-b[0]).map(a=>JSON.stringify(a.slice(1))))].map(a=>JSON.parse(a)); null
let failed = [... new Set(gamesbyname.map(a=>[a[1].variant,a[1].seed,a[1].cards]).map(a=>{let dvari=v.find(b=>b.name===a[0]);let pred=LocalServer.shuffleDeckFromSeed(dvari,a[1]).join();let actual=a[2].map(c=>dvari.suits[c.suitIndex]+c.rank).join();return [dvari.id,a[1],actual===pred,actual,pred]}).filter(a=>!a[2]).sort((a,b)=>a[0]-b[0]).map(a=>JSON.stringify(a.slice(1))))].map(a=>JSON.parse(a)); null
console.log({passed:passed.length,failed:failed.length,passRatio:(passed.length/(passed.length+failed.length))});
