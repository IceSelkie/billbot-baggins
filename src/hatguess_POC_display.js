fs = require("fs");

// Executes: subcall_hatguess_cox.js
// Reads: N/A
// Writes: N/A

transposeStringArray = (arr) => [...arr[0]].map((_, i) => arr.map(a => a[i]));
display = (vals, r = 5, c = 5) => {
  if (!(vals instanceof Array))
    vals = [vals];
  vals = vals.map(a => BigInt(a));
  let mask = 1n;
  let ret = [];
  for (let i = 0; i < r * c; i++) {
    let matched = vals.find(v => v & mask);
    ret.push(!matched ? "." : vals.length == 1 ? "#" : vals.indexOf(matched).toString(36));
    // if (i%c==c-1 && i!=r*c-1)
    //   ret.push("\n");
    mask <<= 1n;
  }
  ret = ret.reverse().join("");
  // return ret;

  // transpose
  ret = ret.split(RegExp(`(${".".repeat(r)})`)).filter(a => a);
  ret = transposeStringArray(ret).map(a => a.join(" ")).join("\n");
  return ret;
}

displayRow = (cards, r, c) => {
  let grid = cards.map(card => display(card, r, c).split("\n"));
  return grid[0].map((_, row) => grid.map(cardText => [...cardText[row]].reverse().join("")).join("    ")).reverse().join("\n");
}



eval(fs.readFileSync("subcall_hatguess_cox.js") + "");

function coxExample() {
  parseGrid = (s) => BigInt(`0b${s.split(" ").map((a, i, arr) => [...a].map((_, j) => arr[j][i]).join("")).join("")}`);
  // rows are suits, cols are ranks
  //   live: r1 r2 r3 r4 r5   y1 ... b5   p1 p2 p3 p4 p5
  //   cox:  b1 b2 b3 b4 b5   g1 ... w5   y1 y2 y3 y4 y5
  // conver to bigint where: 1n = r1/b1, 2n = y1/g1 ...
  let cardMasks = ["00111 00111 10111 11101 01100", "11011 11110 01100 00111 11101", "11110 10101 11110 01101 11101", "00011 11100 01111 00110 01101"].map(parseGrid);
  let cardTruths = ["00000 00000 00010 00000 00000", "00000 10000 00000 00000 00000", "00000 00000 00000 01000 00000", "00000 00000 00000 00000 00100"].map(parseGrid);
  let trash = parseGrid("11000 10000 11100 10000 11000");
  let playable = parseGrid("00100 01000 00010 01000 00100");

  console.log();
  let outputs =
    cardMasks.map((c, i) => {
      console.log(` Card ${i + 1}`);
      console.log(`           ${cardWeightCox(c, playable).join("/")}`);
      let humanReadableA = display(c).split("\n");
      let divisions = submasksCox(c, 8, playable, trash);
      let humanReadableB = display(divisions).split("\n");
      let final = divisions.find(a => a & cardTruths[i]);
      let humanReadableC = display(divisions.find(a => a & cardTruths[i])).split("\n");
      humanReadableA.forEach((_, i) => {
        console.log(
          "",
          humanReadableA[i],
          i == 2 ? " --> " : "     ",
          humanReadableB[i],
          i == 2 ? " --> " : "     ",
          humanReadableC[i]
        );
      });
      console.log();
      return final;
    });
  if (outputs.join() != '414,26906624,65536,1024')
    throw new Error("Output no longer matches example in the Cox et al. paper!");
}
// coxExample();
