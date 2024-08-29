Description of functions and rules:
-----------------------------
1.Constructor:
-
Initializes a smart contract, sets initial values such as number of tickets sold, reserve amount, ticket price, and prize pools.
-----------------------------
2.**`buyTicket
-
The autonomous smart contract (SC) you specify is designed to manage ticket sales, prize distribution, and NFT transfers on the Massa blockchain platform. Here is a detailed description of the features and rules that SC contains:
-----------------------------
Description of features:
-----------------------------
1.Constructor:
-
Initializes a contract and sets default values:
The number of tickets sold (TICKET_SALES_KEY) is set to 0.
Reserve amount (RESERVE_KEY) is set to 0.
The price of the first ticket (CURRENT_TICKET_PRICE_KEY) is set to 5 MAS.
Initial prize pools (SMALL_PRIZES_KEY and MAIN_PRIZES_KEY) are created and stored.
-----------------------------
2.buyTicket()
-
Manages the sale of tickets:
Increases the number of tickets sold.
Saves 1 MAS from each ticket to the reserve.
Divides the remainder of the ticket sale amount into 80% for the main prize pool and 20% for the small prize pool.
Increases the ticket price for the next buyer by 0.2 MAS.
-----------------------------
3.scheduleDailyExecution()
-
Schedules the daily transfer of NFTs to new holders:
Checks if more than one day has passed since the last transfer.
If so, it executes the transfer of NFT Red, Green and Blue to new random ticket holders.
-----------------------------
4.transferNFTs()
-
Performs daily NFT transfers:
Transfers NFT Red, Green and Blue to new random ticket holders.
-----------------------------
5.distributeSmallPrizes()
-
Distributes small prizes every 5 days:
Checks if 5 days have passed since the last distribution of small prizes.
Distributes 20% of the total prize pool into five parts, which are paid out every 5 days.
Each of these portions will be distributed to the NFT Red, Green and Blue holders.
-----------------------------
6.distributeMainPrizes()
-
Distributes the main prizes after 30 days:
Checks if 30 days have passed since the first ticket was sold.
Distributes 80% of the prize pool into three parts:
60% for NFT Red holders.
30% for NFT Green holders.
10% for NFT Blue holders.
-----------------------------
7.transferNFT()
-
A helper function that transfers the NFT to a new random ticket holder.
-----------------------------
8.getTicketHolders()
-
Helper function that returns a list of current ticket holders.
---------------------------------------------------------------------------------------
Rules:
-
1.Reserve: The first 100 MAS from ticket sales are used to create a reserve. For each ticket sold, 1 MAS is added to this reserve until it reaches 100 MAS.
-----------------------------
2.Prize Distribution:
-
Main Prizes: 80% of the prize pool will be distributed to NFT Red (60%), Green (30%) and Blue (10%) holders after 30 days of the first ticket sale.
Small prizes: 20% of the prize pool will be divided into 5 parts, to be paid every 5 days to NFT Red, Green and Blue holders.
-----------------------------
3.Ticket price: The price starts at MAS 5 and increases by MAS 0.2 with each ticket sold.
-----------------------------
4.NFT transfers Each day NFT Red, Green and Blue are transferred to new random ticket holders.
-----------------------------
