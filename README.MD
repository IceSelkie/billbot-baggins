# BillBot Baggins

Billbot is a Hanabi bot written from scratch in NodeJS. It is named after [WillFlame14's bot](https://github.com/WillFlame14/hanabi-bot) named "will-bot".

Its goal is to use [Hatguessing](https://en.wikipedia.org/wiki/Hat_problem) to maximize shared information, while remaining very fast. The original algorithm I am implementing is from the 2014 paper ["How to Make the Perfect Fireworks Display: Two Strategies for Hanabi"](https://www.tandfonline.com/doi/epdf/10.4169/math.mag.88.5.323), where Cox et al. proposed a simple hatguessing algorithm to decide on actions and provide hatguessing hints and hint interpretations. More involved hatguessing algorithms exist which can work almost magically even on difficult variants, such as [Yagami_Black's bot](https://github.com/kkqzhou/hanabi-live-bot) (who also has a modified version that is playable by humans that is documented [here](https://docs.google.com/document/d/1295TjRKQ9rQsAzAymOoQQ85Gb5_3nOD-f8PqXD4dNjg/edit)).


### Running the bot
***This is currently a work-in-progress and currently will not function as-is. You may need to create and/or move some directories to get it to function.***
Create an account at [hanab.live](https://hanab.live/) (generously hosted by Zamiel), and save the token to the file "token_v2.json" with the format: `{"username":{"token":["hanabi.sid=BASE64TOKENGOESHERE="]}}`
Install NodeJS and use `npm i` to install the project's dependencies (only the library `ws`)
Build the derived data with `node 0_run_all.js` for the bot from the variant descriptions, then finally:
Start the bot from the command line with `node 0_start_bot.js`.

### Using the Bot
Similar to WillFlame's bot, pm the bot `/join` to have it join your table, or `/join {password}` if you have a password on the room. Pm the bot `/leave` to make it leave, or `/leaveall` in the table's chat to make all bots leave.
