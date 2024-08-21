import {
  Args,
  stringToBytes,
  u32ToBytes,
  bytesToString,
  bytesToU32,
  u256ToBytes,
  bytesToU256,
} from '@massalabs/as-types';
import {
  Storage,
  transferCoins,
  Address,
  scheduleCall,
  Context,
} from '@massalabs/massa-as-sdk';
import { Random } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

// Configuration
const MAX_TICKETS = 200;
const START_PRICE = 5; // 5 MAS
const INCREMENT = 0.2; // 0.2 MAS
const FIRST_PLACE_PERCENT = 50;
const SECOND_PLACE_PERCENT = 30;
const THIRD_PLACE_PERCENT = 20;
const DAILY_TRANSFER_FEE = 0.1; // 0.1 MAS

// Keys for storage in the datastore
const TICKET_HOLDERS_KEY = stringToBytes('TICKET_HOLDERS');
const FIRST_MINT_TIMESTAMP_KEY = stringToBytes('FIRST_MINT_TIMESTAMP');
const LAST_EXECUTION_KEY = stringToBytes('LAST_EXECUTION');

// Add a new ticket holder and set the timestamp for the first mint
export function addTicketHolder(holderAddress: string): void {
  const holders = getTicketHolders();
  holders.push(holderAddress);
  Storage.set(TICKET_HOLDERS_KEY, serializeStringArray(holders));

  // Store the timestamp on the first mint of a ticket
  if (holders.length === 1) {
    Storage.set(FIRST_MINT_TIMESTAMP_KEY, u32ToBytes(Context.timestamp().toU32()));
  }
}

// Get the list of ticket holders
function getTicketHolders(): string[] {
  const storedData = Storage.get(TICKET_HOLDERS_KEY);
  return storedData ? deserializeStringArray(storedData) : [];
}

// Schedule daily NFT transfers
export function scheduleDailyExecution(): void {
  const lastExecution = bytesToU32(Storage.get(LAST_EXECUTION_KEY));
  const now = Context.timestamp().toU32();
  const firstMintTimestamp = bytesToU32(Storage.get(FIRST_MINT_TIMESTAMP_KEY));
  const thirtyDaysLater = firstMintTimestamp + 30 * 86400000;

  if (now < thirtyDaysLater && (lastExecution == 0 || now - lastExecution >= 86400000)) {
    // Schedule the contract to wake up again in 24 hours
    scheduleCall(Context.selfAddress(), 'transferNFTs', [], 86400000);
    Storage.set(LAST_EXECUTION_KEY, u32ToBytes(now));
  }
}

// Transfer NFTs to random holders
export function transferNFTs(_: StaticArray<u8>): void {
  const holders = getTicketHolders();
  assert(holders.length > 0, 'No ticket holders available');

  const firstMintTimestamp = bytesToU32(Storage.get(FIRST_MINT_TIMESTAMP_KEY));
  const now = Context.timestamp().toU32();
  const thirtyDaysLater = firstMintTimestamp + 30 * 86400000;

  // If the current date <= 30th day, perform daily transfer
  if (now <= thirtyDaysLater) {
    // Transfer RED NFT
    transferRandomNFT('RED_NFT', holders);

    // Transfer GREEN NFT
    transferRandomNFT('GREEN_NFT', holders);

    // Transfer BLUE NFT
    transferRandomNFT('BLUE_NFT', holders);

    // Schedule the next transfer
    scheduleDailyExecution();
  } else if (now > thirtyDaysLater && now <= thirtyDaysLater + 86400000) {
    // If it's the 31st day, perform the final transfer and halt ASC operations
    transferFinalNFTs(holders);
  }
}

// Transfer a random NFT to a random holder
function transferRandomNFT(nftKey: string, holders: string[]): void {
  const randomIndex = Random.nextInt(holders.length);
  const newHolder = holders[randomIndex];

  const nftOwner = bytesToString(Storage.get(stringToBytes(nftKey)));
  // NFT transfer implementation needs to be realized
  transferNFT(nftOwner, newHolder, nftKey);

  Storage.set(stringToBytes(nftKey), stringToBytes(newHolder));
}

// Final transfer of NFTs after 30 days
function transferFinalNFTs(holders: string[]): void {
  // Transfer the final RED NFT
  transferRandomNFT('RED_NFT', holders);

  // Transfer the final GREEN NFT
  transferRandomNFT('GREEN_NFT', holders);

  // Transfer the final BLUE NFT
  transferRandomNFT('BLUE_NFT', holders);

  // ASC terminates here (additional logic for termination can be implemented)
}

// Helper functions for serializing and deserializing string arrays
function serializeStringArray(arr: string[]): StaticArray<u8> {
  const args = new Args();
  for (let i = 0; i < arr.length; i++) {
    args.addString(arr[i]);
  }
  return args.serialize();
}

function deserializeStringArray(data: StaticArray<u8>): string[] {
  const args = new Args(data);
  const result = new Array<string>();
  while (args.hasMore()) {
    result.push(args.nextString().unwrap());
  }
  return result;
}

// Transfer NFTs between holders (implementation depends on the specific NFT contract)
function transferNFT(from: string, to: string, nftKey: string): void {
  // Implementation of NFT transfer should be tailored according to the NFT contract being used
  // This part is adapted to the specific use case, and the logic for transferring the NFT should be implemented here
}
