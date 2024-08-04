fs=require("fs"); os=require("os"); path=require("path"); home=os.homedir();

eval(""+fs.readFileSync("variants_POC_verify_clues.js"));
eval(""+fs.readFileSync("variants_POC_generate.js"));
eval(""+fs.readFileSync("variants_POC_playable.js"));
eval(""+fs.readFileSync("hatguess_POC_display.js"));
