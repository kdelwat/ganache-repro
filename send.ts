import { ContractFactory, Wallet, ethers } from "ethers";
const cluster = require("cluster");

// Change these to try different scenarios
const N_CPUS = 32;
const TRANSACTIONS_PER_CPU = 256;
const TRANSACTION_COUNT = N_CPUS * TRANSACTIONS_PER_CPU;

if (TRANSACTION_COUNT % N_CPUS !== 0) {
  throw new Error("TRANSACTION_COUNT must be divisible by N_CPUS");
}

// These can remain constant; they don't seem to have an effect on the bug
const GAS_LIMIT: number = 173980512; // High gas limit
const GAS_PRICE: number = 0; // Free gas
const CONTRACT_BYTECODE =
  "0x608060405234801561001057600080fd5b5060f78061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80633fb5c1cb1460415780638381f58a146053578063d09de08a14606d575b600080fd5b6051604c3660046083565b600055565b005b605b60005481565b60405190815260200160405180910390f35b6051600080549080607c83609b565b9190505550565b600060208284031215609457600080fd5b5035919050565b60006001820160ba57634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212207ee2e4d9c3228f7d7bcd3dd9ffc5b67584fcf338cbd4189e30d5e65b747590cd64736f6c634300080d0033";
const PROVIDER_URL = "http://localhost:8777";
const RECEIPT_TIMEOUT = 60000;
const RECEIPT_CONFIRMATIONS = 1;

if (cluster.isMaster) {
  runController().catch((e) => console.log(e));
} else {
  process.on("message", ({ txs }) => {
    runWorker(txs).catch((e) => console.log(e));
  });
}

async function makeWithNonce(factory, wallet, nonce) {
  const req0 = factory.getDeployTransaction();
  req0.nonce = nonce;
  req0.gasLimit = GAS_LIMIT;
  req0.gasPrice = GAS_PRICE;

  return await wallet.signTransaction(req0);
}

async function runController() {
  const wallet = Wallet.createRandom();

  const factory = new ContractFactory([], CONTRACT_BYTECODE, wallet);

  const txs: string[] = [];

  for (let i = TRANSACTION_COUNT - 1; i >= 0; i--) {
    txs.push(await makeWithNonce(factory, wallet, i));
  }

  shuffle(txs);

  const chunkSize = Math.floor(txs.length / N_CPUS);
  const chunks: string[][] = chunk(chunkSize, txs);

  for (var i = 0; i < N_CPUS; i++) {
    const worker = cluster.fork();
    worker.send({ txs: chunks[i] });
  }

  cluster.on("exit", (worker) => {
    console.log("Finished worker", worker.process.pid);
  });
}

async function runWorker(signedTxs: string[]) {
  console.log("Started worker", process.pid);

  const provider = new ethers.providers.JsonRpcProvider({
    url: PROVIDER_URL,
  });

  const receipts: any[] = await Promise.all(
    signedTxs.map((tx) => submitSignedTransaction(provider, tx))
  );

  for (const tx of receipts) {
    try {
      const receipt = await provider.waitForTransaction(
        tx,
        RECEIPT_CONFIRMATIONS,
        RECEIPT_TIMEOUT
      );
      console.log(
        `TX included in block (tx = ${tx}, block = ${receipt.blockNumber})`
      );
    } catch (e) {
      console.error(e);
      console.error(`TX timed out (tx = ${tx})`);
    }
  }

  process.exit(0);
}

async function submitSignedTransaction(provider, tx): Promise<string> {
  const hash0 = await provider.sendTransaction(tx);
  return hash0.hash;
}

/** HELPERS */

// https://stackoverflow.com/questions/8495687/split-array-into-chunks
function chunk<T>(chunkSize: number, xs: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < xs.length; i += chunkSize) {
    const chunk = xs.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  return chunks;
}

// Random array sort
// https://stackoverflow.com/a/2450976
function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}
