fs=require("fs"); os=require("os"); path=require("path"); home=os.homedir();

// Executes: subcall_variants_transformer.js
// Reads: "wshistory/db_example_games_by_variant_id.json"
//        variants_combined.json
//        derived_empirical_decks.json (depends on "verify_clues")
// Writes: derived_touches.json
//         derived_transformed.json




// variant objects
variants = data = Object.values(JSON.parse(fs.readFileSync("variants_combined.json"))) ; variants.length;
variantsById = new Map(data.map(v=>[v.id,v]))
// varid -> dbgameid
db = JSON.parse(fs.readFileSync("wshistory/db_example_games_by_variant_id.json")) ; Object.keys(db).length;

// // ["No Variant", "01,01,01,02,...,44,44,45"]
// nametocard_emp = JSON.parse(fs.readFileSync("derived_empirical_decks.json")) ; null
// // [0, "R1,R1,R1,R2,...,P4,P4,P5"]
// idtocards_emp = nametocard_emp.map(([vname,str])=>[variants.find(v=>v.name==vname),str]).map(([v,str])=>[v.id,str.split(",").map(([suit,rank])=>v.suits[suit].abbreviation+rank).join()]) ; null


// This exists in variants_transformer now
// // PREDICT CARDS
// predictedCards = data.map(v=>{
//   // Default rank composition for each suit
//   let comp=v.stackSize==4?'11223344':v.sudoku?'1122334455':v.upOrDown?'122334457':v.criticalRank==4?'111223345':'1112233445';
//   return [v.id,v.suits.flatMap(s=>{
//     // If special suit, modify composition
//     let comp2=s.oneOfEach?(v.upOrDown?'123457':'12345'):s.reversed?'1223344555':comp;
//     // Create the cards for this suit
//     return [...comp2].map(r=>s.abbreviation+r)
//   // Then join the whole deck together
//   }).join()]})

// // For each empirical example
// mise = idtocards_emp.filter(([empVari, empCards])=>
//   // find its matching prediction, and retain the ones that dont match.
//   predictedCards.find(([predVari, predictCards])=>predVari==empVari)[1]!==empCards);
// // And complain if 
// if (mise.length) console.log(`Incorrect predicted deck composition for ${mise.length} of ${idtocards_emp.length} variants with empirical examples. See "mise" object.`);


// Run the variants transformer
v = eval(""+fs.readFileSync("subcall_variants_transformer.js"));
// Save hint touches to file.
fs.writeFileSync("derived_touches.json",`[\n  ${v.map(a=>`[${a.id}, ${JSON.stringify(a.touches)}]`).join(",\n  ")}\n]\n`);
// Save the whole object(s):
fs.writeFileSync("derived_transformed.json",`[\n  ${v.map(a=>`[${a.id}, ${JSON.stringify(a)}]`).join(",\n  ")}\n]\n`);

// v = eval(""+fs.readFileSync("subcall_variants_transformer.js"));fs.writeFileSync("derived_touches.json",`[\n  ${v.map(a=>`[${a.id}, ${JSON.stringify(a.touches)}]`).join(",\n  ")}\n]\n`);

