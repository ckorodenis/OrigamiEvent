import {
  Args,
  stringToBytes,
  bytesToString,
  u32ToBytes,
  bytesToU32,
  u64ToBytes,
  bytesToU64,
} from '@massalabs/as-types';
import {
  _transferFrom,
} from './NFT-internals';
import { 
  Storage,
  transferCoins,
  Address,
  scheduleCall,
  Context,
} from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

/**
 * Constants for timing and initial settings
 */
const TICKET_PRICE = u64(5 * 1e9); // Initial price in MAS (5 MAS)
const PRICE_INCREMENT = u64(0.2 * 1e9); // Increment per ticket (0.2 MAS)
const TOTAL_TICKETS = 200;
const RESERVE_AMOUNT = u64(100 * 1e9); // 100 MAS reserve
const SMALL_WIN_PERCENTAGE = u64(20); // 20% for small wins
const MAIN_WIN_PERCENTAGE = u64(80); // 80% for main wins
const SMALL_WIN_INTERVAL = 5 * 86400000; // 5 days in milliseconds
const END_DATE = 30 * 86400000; // 30 days in milliseconds

// Contract keys
const TOTAL_SALES_KEY = stringToBytes('TOTAL_SALES');
const CURRENT_TICKET_PRICE_KEY = stringToBytes('CURRENT_TICKET_PRICE');
const LAST_EXECUTION_KEY = stringToBytes('LAST_EXECUTION');
const MAIN_PRIZE_POOL_KEY = stringToBytes('MAIN_PRIZE_POOL');
const SMALL_PRIZE_POOL_KEY = stringToBytes('SMALL_PRIZE_POOL');
const RED_NFT_KEY = stringToBytes('RED_NFT');
const GREEN_NFT_KEY = stringToBytes('GREEN_NFT');
const BLUE_NFT_KEY = stringToBytes('BLUE_NFT');
const START_TIME_KEY = stringToBytes('START_TIME');

// Initialization
export function initialize(): void {
  Storage.set(TOTAL_SALES_KEY, u64ToBytes(0));
  Storage.set(CURRENT_TICKET_PRICE_KEY, u64ToBytes(TICKET_PRICE));
  Storage.set(MAIN_PRIZE_POOL_KEY, u64ToBytes(0));
  Storage.set(SMALL_PRIZE_POOL_KEY, u64ToBytes(0));
  Storage.set(START_TIME_KEY, u64ToBytes(Context.timestamp().toU64()));
}



// Buy a ticket
export function buyTicket(buyer: string): void {
  let totalSales = bytesToU64(Storage.get(TOTAL_SALES_KEY));
  let currentPrice = bytesToU64(Storage.get(CURRENT_TICKET_PRICE_KEY));

  // Increase sales count
  totalSales += currentPrice;
  Storage.set(TOTAL_SALES_KEY, u64ToBytes(totalSales));

  // Update prize pools
  updatePrizePools(totalSales);

  // Increase the ticket price for the next buyer
  currentPrice += PRICE_INCREMENT;
  Storage.set(CURRENT_TICKET_PRICE_KEY, u64ToBytes(currentPrice));
}

// Update the prize pools based on total sales
function updatePrizePools(totalSales: u64): void {
  if (totalSales <= RESERVE_AMOUNT) {
    // Still collecting reserve
    return;
  }

  let remainingSales = totalSales - RESERVE_AMOUNT;

  // Calculate pools
  let mainPrizePool = remainingSales * MAIN_WIN_PERCENTAGE / 100;
  let smallPrizePool = remainingSales * SMALL_WIN_PERCENTAGE / 100;

  Storage.set(MAIN_PRIZE_POOL_KEY, u64ToBytes(mainPrizePool));
  Storage.set(SMALL_PRIZE_POOL_KEY, u64ToBytes(smallPrizePool));
}




// Distribute main prizes after 30 days
export function distributeMainPrizes(): void {
  let now = Context.timestamp().toU64();
  let startTime = bytesToU64(Storage.get(START_TIME_KEY));

  assert(now >= startTime + END_DATE, 'Main prizes can only be distributed after 30 days');

  let mainPrizePool = bytesToU64(Storage.get(MAIN_PRIZE_POOL_KEY));

  // Distribute to NFT holders
  distributeToNFT(mainPrizePool, RED_NFT_KEY, 60);
  distributeToNFT(mainPrizePool, GREEN_NFT_KEY, 30);
  distributeToNFT(mainPrizePool, BLUE_NFT_KEY, 10);
}

// Distribute small prizes every 5 days
export function distributeSmallPrizes(): void {
  let now = Context.timestamp().toU64();
  let lastExecution = bytesToU64(Storage.get(LAST_EXECUTION_KEY));

  if (now >= lastExecution + SMALL_WIN_INTERVAL) {
    let smallPrizePool = bytesToU64(Storage.get(SMALL_PRIZE_POOL_KEY));

    // Divide by 5 days
    let dailySmallPrize = smallPrizePool / 5;

    // Distribute to NFT holders
    distributeToNFT(dailySmallPrize, RED_NFT_KEY, 100 / 3);
    distributeToNFT(dailySmallPrize, GREEN_NFT_KEY, 100 / 3);
    distributeToNFT(dailySmallPrize, BLUE_NFT_KEY, 100 / 3);

    // Update last execution time
    Storage.set(LAST_EXECUTION_KEY, u64ToBytes(now));
  }
}

// Distribute amount to a specific NFT holder based on percentage
function distributeToNFT(totalAmount: u64, nftKey: StaticArray<u8>, percentage: u64): void {
  let nftOwner = bytesToString(Storage.get(nftKey));
  let amount = totalAmount * percentage / 100;
  transferCoins(new Address(nftOwner), amount);
}




// Transfer NFTs to another random ticket holder every day
export function transferNFTsDaily(): void {
  let now = Context.timestamp().toU64();
  let lastExecution = bytesToU64(Storage.get(LAST_EXECUTION_KEY));

  if (now >= lastExecution + 86400000) { // 1 day in milliseconds
    let totalSales = bytesToU64(Storage.get(TOTAL_SALES_KEY));
    let currentIndex = (now / 86400000) % (totalSales / TICKET_PRICE); // Modulo operation to cycle through ticket holders

    // Logic to determine the new owner based on currentIndex
    let newOwner = getNewOwner(currentIndex);

    // Transfer NFTs
    transferNFT(RED_NFT_KEY, newOwner);
    transferNFT(GREEN_NFT_KEY, newOwner);
    transferNFT(BLUE_NFT_KEY, newOwner);

    // Update last execution time
    Storage.set(LAST_EXECUTION_KEY, u64ToBytes(now));
  }
}

// Transfer a specific NFT to a new owner
function transferNFT(nftKey: StaticArray<u8>, newOwner: string): void {
  let currentOwner = bytesToString(Storage.get(nftKey));
  _transferFrom(currentOwner, newOwner, bytesToU256(Storage.get(nftKey)));
  Storage.set(nftKey, stringToBytes(newOwner));
}

// Logic to determine new owner from the list of ticket holders
function getNewOwner(index: u64): string {
  // Implement logic to get new owner address based on ticket index
  // This would typically involve storing a mapping of ticket numbers to addresses
  return ''; // Replace with actual logic
}











