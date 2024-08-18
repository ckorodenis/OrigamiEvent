import {
  Args,
  boolToByte,
  stringToBytes,
  u256ToBytes,
  bytesToString,
  bytesToU256,
  u64ToBytes,
  bytesToU64,
  u32ToBytes,
  bytesToU32,
} from '@massalabs/as-types';
import {
  _approve,
  _balanceOf,
  _constructor,
  _getApproved,
  _isApprovedForAll,
  _name,
  _ownerOf,
  _setApprovalForAll,
  _symbol,
  _update,
  _transferFrom,
} from './NFT-internals';
import { setOwner, onlyOwner, ownerAddress } from '../utilities/ownership';
import {
  Storage,
  generateEvent,
  transferCoins,
  Address,
  createSC,
  scheduleCall,
  Context,
} from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';
import { Random } from '@massalabs/as-sdk';

/**
 * Constants for timing
 */
const END_DATE = 1735036800000; // December 24, 2024, 12:00:00 PM UTC in UNIX timestamp

// Contract keys
const ORIGAMI_HOLDERS_KEY = stringToBytes('ORIGAMI_HOLDERS');
const RED_NFT_KEY = stringToBytes('RED_NFT');
const GREEN_NFT_KEY = stringToBytes('GREEN_NFT');
const BLUE_NFT_KEY = stringToBytes('BLUE_NFT');
const LAST_EXECUTION_KEY = stringToBytes('LAST_EXECUTION');

// Add holder to the OrigamiTicket holder list
export function addOrigamiHolder(holderAddress: string): void {
  const holders = getOrigamiHolders();
  holders.push(holderAddress);
  Storage.set(ORIGAMI_HOLDERS_KEY, serializeStringArray(holders));
}

// Get the list of OrigamiTicket holders
function getOrigamiHolders(): string[] {
  const storedData = Storage.get(ORIGAMI_HOLDERS_KEY);
  return storedData ? deserializeStringArray(storedData) : [];
}

// Schedule daily execution for transferring NFTs
export function scheduleDailyExecution(): void {
  const lastExecution = bytesToU32(Storage.get(LAST_EXECUTION_KEY));
  const now = Context.timestamp().toU32();

  if (now < END_DATE && (lastExecution == 0 || now - lastExecution >= 86400000)) {
    // Schedule the contract to wake up again in 24 hours
    scheduleCall(Context.selfAddress(), 'transferNFTs', [], 86400000);
    Storage.set(LAST_EXECUTION_KEY, u32ToBytes(now));
  }
}

// Transfer RED, GREEN, and BLUE NFTs to random holders
export function transferNFTs(_: StaticArray<u8>): void {
  const holders = getOrigamiHolders();
  assert(holders.length > 0, 'No OrigamiTicket holders available');

  // Transfer RED NFT
  transferRandomNFT(RED_NFT_KEY, holders);

  // Transfer GREEN NFT
  transferRandomNFT(GREEN_NFT_KEY, holders);

  // Transfer BLUE NFT
  transferRandomNFT(BLUE_NFT_KEY, holders);

  // Schedule the next execution
  scheduleDailyExecution();
}

// Transfer a random NFT to a random holder
function transferRandomNFT(nftKey: StaticArray<u8>, holders: string[]): void {
  const randomIndex = Random.nextInt(holders.length);
  const newHolder = holders[randomIndex];

  const nftOwner = bytesToString(Storage.get(nftKey));
  _transferFrom(nftOwner, newHolder, bytesToU256(Storage.get(nftKey)));

  Storage.set(nftKey, stringToBytes(newHolder));
}

// On December 24, 2024, distribute 1 MAS to holders of RED, GREEN, and BLUE NFTs
export function distributeRewards(_: StaticArray<u8>): void {
  const now = Context.timestamp().toU32();
  assert(now >= END_DATE, 'It is not yet time to distribute rewards');

  // Distribute to the current holders of RED, GREEN, and BLUE NFTs
  distributeRewardToHolder(RED_NFT_KEY);
  distributeRewardToHolder(GREEN_NFT_KEY);
  distributeRewardToHolder(BLUE_NFT_KEY);
}

// Transfer 1 MAS to the holder of a specific NFT
function distributeRewardToHolder(nftKey: StaticArray<u8>): void {
  const holder = bytesToString(Storage.get(nftKey));
  transferCoins(new Address(holder), fromMAS(1));
}

// Serialization helper functions for string arrays
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
