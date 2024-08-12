fs=require("fs"); os=require("os"); path=require("path"); home=os.homedir();

// Executes: subcall_verify_game.js
// Reads: "wshistory/c*.json"
//        variants_combined.json
//        derived_touches.json
// Writes: derived_example_games.json
//         derived_empirical_decks.json
//         derived_empirical_clues.json


// LOAD DATA

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

// Order by variant
gamesbyname = games.map(a=>a.map((a,i)=>JSON.parse(a.slice(([5,15,15])[i])))).map(([{options,seed,databaseID},{list},{cardIdentities}])=>[options.variantName,{variant:options.variantName,databaseID:databaseID,seed,actions:list,cards:cardIdentities}]) ; gamesbyname=Object.entries(Object.fromEntries(gamesbyname)) ; gamesbyname.length;
fs.writeFileSync("derived_example_games.json",`{\n  ${gamesbyname.map(([k,v])=>JSON.stringify(k)+": "+JSON.stringify(v)).join(",\n  ")}\n}\n`);

// Create a sorted card list for each variant (ensure that variants' decks are understood)
nametocards = gamesbyname.map(a=>[a[0],a[1].cards.map(a=>a.suitIndex+""+a.rank).sort().join()]);
fs.writeFileSync("derived_empirical_decks.json",`[\n  ${nametocards.map(a=>JSON.stringify(a)).join(",\n  ")}\n]\n`);

// Variant details to for suit names and linking variant IDs and variant names
varbyname = new Map(Object.values(JSON.parse(fs.readFileSync("variants_combined.json"))).map(v=>[v.name,v])) ; varbyname.size;

// provide an example object of each action type
// ((g)=>["draw","clue","status","turn","play","discard","gameOver","strike"].map(k=>g.actions.find(a=>a.type==k)))(gamesbyname[0][1]);



// VERIFY DATA

// Load the games and verify things are as expected
eval(fs.readFileSync("subcall_verify_game.js")+"");
verifyAll = gamesbyname.map(a=>verifyGame(a)) ; null;

// Compile all clues made
cluesToTest = [...new Set(verifyAll.flatMap(a=>a.clues.map(({clueTarget,touched,untouched})=>{return{v:a.info.v,clueTarget,touched:touched.split(",").sort().join(),untouched:untouched.split(",").sort().join()}})).map(a=>JSON.stringify(a)))].map(a=>JSON.parse(a)) ; cluesToTest.length;
fs.writeFileSync("derived_empirical_clues.json",`[\n  ${cluesToTest.map(a=>JSON.stringify(a)).join(",\n  ")}\n]\n`);

// Determine what cards are touched by what clues
// Check against the empirical facts from past games to ensure we understand what clues touch what cards
v_touches = new Map(JSON.parse(fs.readFileSync("derived_touches.json"))); v_touches.size;

// Test each clue case to determine if they pass or not
failed = cluesToTest.map(clueExample=>{
  // Cards in hand
  let cards=[...clueExample.touched.split(","),...clueExample.untouched.split(",")].filter(a=>a).sort();
  // Get and parse the cards-touched-by map from the all-variants object
  let cardTouchedByMap=new Map(v_touches.get(clueExample.v).split(",").map(a=>a.split(":")));
  // Determine which cards are touched
  return {original:clueExample, predicted:cards.filter(b=>cardTouchedByMap.get(b).includes(clueExample.clueTarget)).join()};

}).filter(({original,predicted})=>original.touched!==predicted).sort((a,b)=>a.original.v-b.original.v);

// Status description to ensure progress moves forward and not backwards...
console.log(failed.length,"clues between",new Set(failed.map(a=>a[0].v)).size,`variants (of ${gamesbyname.length}) were prediced incorrectly`);
// Display the first variant's clues that the predicted doesnt match what actually happened.
console.log(failed.length==0 ? "(No failed cases to display...)" : failed.filter((a,i,arr)=>a.original.v==arr[0].original.v));
