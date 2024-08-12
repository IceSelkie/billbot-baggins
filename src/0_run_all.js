fs = require("fs"); os = require("os"); path = require("path"); home = os.homedir();

eval("" + fs.readFileSync("variants_POC_verify_clues.js"));
eval("" + fs.readFileSync("variants_POC_generate.js")); // variants, v
eval("" + fs.readFileSync("variants_POC_playable.js")); // games, db, tuples
eval("" + fs.readFileSync("hatguess_POC_display.js")); // tuples

GameState = eval("" + fs.readFileSync("subcall_gamestate.js")); // gamestate
