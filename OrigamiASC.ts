import {
  Args,
  stringToBytes,
  bytesToString,
  u256ToBytes,
  bytesToU256,
  u64ToBytes,
  bytesToU64,
  u32ToBytes,
  bytesToU32,
} from '@massalabs/as-types';
import {
  _transferFrom,
} from './NFT-internals';
import {
  Storage,
  generateEvent,
  transferCoins,
  Address,
  Context,
  Timer, // Import for automation
} from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';
import { Random } from '@massalabs/as-sdk';

/**
 * Constants for the game
 */
const TOTAL_TICKETS = 200;
const INITIAL_TICKET_PRICE = 5000000000; // 5 MAS
const TICKET_PRICE_INCREMENT = 200000000; // 0.2 MAS
const RESERVE_AMOUNT = 100000000000; // 100 MAS
const END_DATE_OFFSET = 2592000000; // 30 days in milliseconds
const VESTING_INTERVAL = 86400000; // 1 day in milliseconds for vesting

// Contract keys
const RESERVE_KEY = stringToBytes('RESERVE');
const TICKET_SALES_KEY = stringToBytes('TICKET_SALES');
const LAST_TICKET_SOLD_TIMESTAMP_KEY = stringToBytes('LAST_TICKET_SOLD');
const CURRENT_TICKET_PRICE_KEY = stringToBytes('CURRENT_TICKET_PRICE');
const RED_NFT_KEY = stringToBytes('RED_NFT');
const GREEN_NFT_KEY = stringToBytes('GREEN_NFT');
const BLUE_NFT_KEY = stringToBytes('BLUE_NFT');
const SMALL_PRIZES_KEY = stringToBytes('SMALL_PRIZES');
const MAIN_PRIZES_KEY = stringToBytes('MAIN_PRIZES');
const LAST_EXECUTION_KEY = stringToBytes('LAST_EXECUTION');

// Struct to hold prize pool details
class PrizePool {
  smallPrizePool: u256;
  mainPrizePool: u256;

  constructor() {
    this.smallPrizePool = u256.Zero;
    this.mainPrizePool = u256.Zero;
  }

  serialize(): StaticArray<u8> {
    const args = new Args();
    args.addU256(this.smallPrizePool);
    args.addU256(this.mainPrizePool);
    return args.serialize();
  }

  static deserialize(data: StaticArray<u8>): PrizePool {
    const args = new Args(data);
    const smallPrizePool = args.nextU256().unwrap();
    const mainPrizePool = args.nextU256().unwrap();
    return new PrizePool(smallPrizePool, mainPrizePool);
  }
}

// Initializes the contract, setting initial values
export function constructor(): void {
  Storage.set(TICKET_SALES_KEY, u64ToBytes(0));
  Storage.set(RESERVE_KEY, u64ToBytes(0));
  Storage.set(CURRENT_TICKET_PRICE_KEY, u256ToBytes(new u256(INITIAL_TICKET_PRICE)));
  Storage.set(SMALL_PRIZES_KEY, (new PrizePool()).serialize());
  Storage.set(MAIN_PRIZES_KEY, (new PrizePool()).serialize());

  // Schedule automated daily execution for NFT transfer
  Timer.createRecurring("scheduleDailyExecution", 86400000); // Trigger every day
}

// Function to handle ticket purchases
export function buyTicket(): void {
  let ticketSales = bytesToU64(Storage.get(TICKET_SALES_KEY));
  assert(ticketSales < TOTAL_TICKETS, 'All tickets have been sold');

  // Update the ticket sales count
  ticketSales += 1;
  Storage.set(TICKET_SALES_KEY, u64ToBytes(ticketSales));

  // Determine the current ticket price
  let ticketPrice = bytesToU256(Storage.get(CURRENT_TICKET_PRICE_KEY));

  // 1 MAS goes to reserve
  let reserve = bytesToU64(Storage.get(RESERVE_KEY));
  reserve += 1000000000; // 1 MAS
  Storage.set(RESERVE_KEY, u64ToBytes(reserve));

  // Remaining amount goes to the prize pools
  let remainingAmount = ticketPrice.sub(new u256(1000000000)); // subtract 1 MAS for reserve
  let smallPrizeAmount = remainingAmount.mul(new u256(20)).div(new u256(100)); // 20% to small prize pool
  let mainPrizeAmount = remainingAmount.sub(smallPrizeAmount); // 80% to main prize pool

  // Update prize pools
  let prizePool = PrizePool.deserialize(Storage.get(SMALL_PRIZES_KEY));
  prizePool.smallPrizePool = prizePool.smallPrizePool.add(smallPrizeAmount);
  Storage.set(SMALL_PRIZES_KEY, prizePool.serialize());

  prizePool = PrizePool.deserialize(Storage.get(MAIN_PRIZES_KEY));
  prizePool.mainPrizePool = prizePool.mainPrizePool.add(mainPrizeAmount);
  Storage.set(MAIN_PRIZES_KEY, prizePool.serialize());

  // Increase the ticket price for the next buyer
  ticketPrice = ticketPrice.add(new u256(TICKET_PRICE_INCREMENT));
  Storage.set(CURRENT_TICKET_PRICE_KEY, u256ToBytes(ticketPrice));

  // Record the timestamp of this sale
  Storage.set(LAST_TICKET_SOLD_TIMESTAMP_KEY, u64ToBytes(Context.timestamp()));
}

// Automated Function to execute daily transfers of NFTs
export function scheduleDailyExecution(): void {
  const now = Context.timestamp().toU32();
  const lastExecution = bytesToU32(Storage.get(LAST_EXECUTION_KEY));
  
  if (now < bytesToU64(Storage.get(LAST_TICKET_SOLD_TIMESTAMP_KEY)).toU32() + END_DATE_OFFSET && (lastExecution == 0 || now - lastExecution >= 86400000)) {
    transferNFTs();
    Storage.set(LAST_EXECUTION_KEY, u32ToBytes(now));
  }
}

// Function to transfer NFTs to next holders
function transferNFTs(): void {
  const holders = getTicketHolders();
  assert(holders.length > 0, 'No ticket holders available');

  // Transfer NFTs to next holders
  transferNFT(RED_NFT_KEY, holders);
  transferNFT(GREEN_NFT_KEY, holders);
  transferNFT(BLUE_NFT_KEY, holders);
}

// Function to distribute main prizes in vesting mode
export function distributeMainPrizes(): void {
  const now = Context.timestamp().toU32();
  const ticketSoldTimestamp = bytesToU64(Storage.get(LAST_TICKET_SOLD_TIMESTAMP_KEY)).toU32();
  assert(now >= ticketSoldTimestamp + END_DATE_OFFSET, 'It is not yet time to distribute main prizes');

  const holders = getTicketHolders();
  assert(holders.length > 0, 'No ticket holders available');

  // Retrieve and distribute main prize pool using vesting over several intervals
  let prizePool = PrizePool.deserialize(Storage.get(MAIN_PRIZES_KEY));
  let totalMainPrize = prizePool.mainPrizePool;
  
  // Vesting over a defined number of days (e.g., 10 days)
  let vestingAmount = totalMainPrize.div(new u256(10));
  Timer.createRecurring("vestingTransfer", VESTING_INTERVAL, 10, holders, vestingAmount);
}

// Helper function to vest the transfer of prizes over time
function vestingTransfer(holders: string[], vestingAmount: u256): void {
  // Distribute according to 60% (RED), 30% (GREEN), and 10% (BLUE)
  transferCoins(new Address(holders[0]), vestingAmount.mul(new u256(60)).div(new u256(100))); // RED holder
  transferCoins(new Address(holders[1]), vestingAmount.mul(new u256(30)).div(new u256(100))); // GREEN holder
  transferCoins(new Address(holders[2]), vestingAmount.mul(new u256(10)).div(new u256(100))); // BLUE holder
}

// Helper function to transfer an NFT
function transferNFT(nftKey: StaticArray<u8>, holders: string[]): void {
  const randomIndex = Random.nextInt(holders.length);
  const newHolder = holders[randomIndex];

  const nftOwner = bytesToString(Storage.get(nftKey));
  _transferFrom(nftOwner, newHolder, bytesToU256(Storage.get(nftKey)));

  Storage.set(nftKey, stringToBytes(newHolder));
}

// Helper function to get all ticket holders
function getTicketHolders(): string[] {
  // This function should return an array of addresses that currently hold tickets
  return ['holder1', 'holder2', 'holder3']; // Placeholder addresses
}
