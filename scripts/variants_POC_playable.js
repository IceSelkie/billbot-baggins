fs = require("fs"); os = require("os"); path = require("path"); home = os.homedir();

// Executes: subcall_.js
// Reads: variants_combined.json
//        derived_transformed.json (depends on "generate")
// Writes: 


variants = Object.values(JSON.parse(fs.readFileSync("variants_combined.json"))); variants.length;
variantsById = new Map(variants.map(v => [v.id, v]))
// varid -> dbgameid
db = JSON.parse(fs.readFileSync("wshistory/db_example_games_by_variant_id.json")); Object.keys(db).length;

v = JSON.parse(fs.readFileSync("derived_transformed.json")); v.length;
games = JSON.parse(fs.readFileSync("derived_example_games.json")); games.length;

tuples = Object.entries(games).map(([name, game]) => { let vari = variants.find(v => v.name == name); return [vari, v.find(v => v[0] == vari.id)[1], game] });

verifyGame = ([vname, g], maxTurns = -1, shouldClarify = true) => { throw new Error('Load definition from "subcall_verify_game.js".') };
eval(fs.readFileSync("subcall_verify_game.js") + "");

verifyPlayable = (vid, show = false) => { let t = tuples.find(a => a[0].id == vid); let ret = verifyGame([t[0].name, t[2]], true, t[0], t[1]); ret.playPile.forEach(c => { if (show) console.log(/*disp(t[0].suitAbbreviations,t[0].ranks,c.playable)*/display(c.playable)) }); return ret; };
// verifyPlayable(2074).playPile;
verifyPlayable(76);

// Currently doesnt spit out error message(s)
// tuples.map(a=>verifyPlayable(a[0].id).playPile);
