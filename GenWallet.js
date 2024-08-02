const ed = require("@noble/ed25519");
const { varintEncode, base58Encode, hashBlake3 } = require("@massalabs/massa-web3/dist/cmd/utils/Xbqcrypto");
const { SecretKey, Address } = require("@massalabs/massa-web3/dist/cmd/utils/keyAndAddresses");

const SECRET_KEY_PREFIX = "S";
const ADDRESS_PREFIX = "AU";
const VERSION_NUMBER = 0;

async function getNewWallet() {
   const version = Buffer.from(varintEncode(VERSION_NUMBER));

   const secretKeyArray = ed.utils.randomPrivateKey();
   const secretKeyBase58Encoded = SECRET_KEY_PREFIX + base58Encode(Buffer.concat([version, secretKeyArray]));
   const secretKey = new SecretKey(secretKeyBase58Encoded);

   const publicKey = await secretKey.getPublicKey();

   // "AU" + base58Check(version_bytes + hashBlake3(version_bytes + public_key_bytes))
   const addressBase58Encoded = ADDRESS_PREFIX + base58Encode(Buffer.concat([version, hashBlake3(Buffer.concat([version, publicKey.bytes]))]));
   const address = new Address(addressBase58Encoded);

   return {
      address: address.base58Encoded,
      publicKey: publicKey.base58Encoded,
      secretKey: secretKeyBase58Encoded
   };
}

getNewWallet()
   .then(newAccount => {
      console.log(newAccount);
   })
   .catch(err => {
      console.log(err);
   });
