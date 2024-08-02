
// Display a card mask
console.log((disp=(s,r,v,truth=0n)=>{v=BigInt(v);truth=BigInt(truth);let i=1n;return [[" ",...r],...([...s].map(s=>[s, ...([...r].map(r=>{let ret=(v&i)?((truth&i)?"#":"*"):((truth&i)?"O":"."); i*=2n; return ret}))]))].map(a=>a.join(" ")).join("\n")})("RYGBM","12345","31243346","4"));
// Next up: Apply a hint to a mask

// Determine playable card from played history (hard to verify, but also shouldnt have too many edge cases)

// Determine known trash (never playable, so already played AND ranks above discarded)

// Hat Guessing:
// Identify most playable in a hand that isnt guarenteed
// break into n submasks, possibly including another card
// action priorty

