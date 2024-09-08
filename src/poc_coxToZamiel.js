fs=require("fs");

coxToZamielPretty=([r,s])=>"RYGBP"[s]+(+r+1);
coxToZamiel=([r,s])=>{return{suitIndex:+s,rank:+r+1}};

function parseAction(actionStr) {
	// From the string, determine if it is a: Play(0), Discard(1), Color Clue(2), or Rank Clue(3)
	let type=actionStr.includes("played")?0:actionStr.includes("iscard")?1:actionStr.includes("*,")?2:actionStr.includes(",*")?3:null;
	// If it is a clue, extract the suitIndex or rank of which the clue gave
	let value = type<2?undefined:actionStr.match(/\((.),(.)\)/)?.slice(1,3).map((v,i)=>+v+ +!i).filter(a=>!isNaN(a))[0];
	// If it is a clue, extract which player the clue was given to
	let target=type<2?undefined:+actionStr.slice(-1);
	// Get the player the action is from (always at the 8th character in the string)
	let from=Number(actionStr[7]);
	// Return the object
	return {from,type,target,value};
}

data = (
	// Read the file
	fs.readFileSync("hansim_out.txt")
	.toString()
	// Split into blocks of text for each turn
	// (split around the long lines of ==========)
	.split(/={20,}/)
	.map(a=>a.trim())
	.filter(a=>a)
	// For each turn block, split into 4 components:
	//   gamestate,
	//   gamestate&discardCount&cardsPlayed,
	//   playerCards&playerState&discardList,
	//   actionString
	.map(a=>a.split("\n\n"))
	.map(a=>
		[
			// extract gameState and cardsPlayed (further processing later)
			...(
				a[1]
				.trim()
				.split("\n")
				.map(a=>a.trim())
			),
			// extract player hands aka playerCards, skipping playerState
			(
				[...
					a[2]
					.matchAll(/(hand:.*?\n)/g)
				].map(a=>a[0])
				.map(a=>
					a.slice(
						a.indexOf(":")+1,
						-1
					).trim()
				)
			),
			( // discarded list, if it exists
				a[2]
				.split("\n")
				[10]
				?.split(",")
				.filter(a=>a)
				.join()
			),
			( // action string, if it exists
				a[3]
				?.trim()
				.split("\n")
				[0]
			)
		])
	// Futher process and clean up.
	.map(([state,played,hands,discarded,action])=>{return{state:Object.fromEntries(state.split(/ +/).map(a=>a.split(":")).map(([k,v])=>[k,Number(v)])),played:played.split(/ +/).map(coxToZamiel),hands:hands.map(hand=>hand.split(/ +/).map(coxToZamiel)),discarded:discarded?.split(",").map(coxToZamiel),action:action?parseAction(action):action}})
);

// Figure out the order of cards in the deck
deck = (
	[
		// Starting hands, in order
		data[0].hands,
		(
			// For actions that draw
			data.filter(a=>a.action?.type<2)
			.map(a=>(
				// In the turn after the action
				data[a.state.Turn+1]
				// Get the last (newest) card from the hand
				.hands[a.action.from][3]
			))
		)
	]
	// Join the lists together
	.flat(2)
	// remove the null from no action occurring at the end of the game
	.filter(a=>a)
);

// Find when new cards are drawn, and find out which card disappeared for that draw to occur.
playDiscardIndecies = (
	// All actions that draw a card
	data.filter(a=>a.action?.type<2)
	// Extract turn number, and whose turn it is
	.map(a=>[a.state.Turn,a.action.from])
	// From the turn index (i) and the player index (pi)...
	.map(([i,pi])=>{
		// Get the before (left) and after (right)
		let l=data[i].hands[pi].map(a=>JSON.stringify(a));
		let r=data[i+1].hands[pi].slice(0,3).map(a=>JSON.stringify(a)); // the last new card was just drawn, so we can ignore that

		// Return first index that doesnt match
		for (let i=0;i<3;i++)
			if (l[i]!=r[i])
				return i;
		// Return last index if none of the first 3 changed.
		return 3;
	})
);


actions = (
	data
	.reduce(
		({oi,pdi,hands,actions},{action})=>{
			if(action?.type<2){
				let hand=hands[action.from];
				let target=hand.splice(playDiscardIndecies[pdi++],1);
				hand.push(oi++);
				action.target=target[0];
			}
			actions.push(action);
			return{oi,pdi,hands,actions};
		},{
			oi:5*4,
			pdi:0,
			hands:new Array(5).fill().map((_,i)=>new Array(4).fill().map((_,j)=>4*i+j)),
			actions:[]
		})
	.actions
	.filter(a=>a)
	.map(a=>{delete a.from; return a})
);


// Convert to Hanab.live's JSON Replay format
console.log(JSON.stringify(
	{
		"players":["Alice","Bob","Cathy","Donald","Emily"],
		"options":{"variant":"No Variant"},
		deck,
		actions
	}))