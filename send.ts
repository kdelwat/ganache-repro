import { ContractFactory, Wallet, ethers } from "ethers";
const cluster = require("cluster");
import * as fs from "fs";
const GAS_LIMIT: number = 173980512; // Determined experimentally to cover all our transactions
const GAS_PRICE: number = 0; // Geora nodes have a gas price of 0

const cpus = 1;

// https://medium.com/hackernoon/multithreading-multiprocessing-and-the-nodejs-event-loop-5b2929bd450b
if (cluster.isMaster) {
  async function main() {
    const wallet = Wallet.createRandom();

    fs.writeFileSync("/tmp/walletpkey", wallet.privateKey);

    const bytecode =
      "0x608060405234801561001057600080fd5b5060f78061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80633fb5c1cb1460415780638381f58a146053578063d09de08a14606d575b600080fd5b6051604c3660046083565b600055565b005b605b60005481565b60405190815260200160405180910390f35b6051600080549080607c83609b565b9190505550565b600060208284031215609457600080fd5b5035919050565b60006001820160ba57634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212207ee2e4d9c3228f7d7bcd3dd9ffc5b67584fcf338cbd4189e30d5e65b747590cd64736f6c634300080d0033";

    const factory = new ContractFactory([], bytecode, wallet);

    const txs: string[] = [];

    for (let i = 4; i >= 0; i--) {
      txs.push(await makeWithNonce(factory, wallet, i));
    }

    shuffle(txs);
    const chunks: string[][] = [];

    // https://stackoverflow.com/questions/8495687/split-array-into-chunks
    const chunkSize = Math.floor(txs.length / cpus);
    for (let i = 0; i < txs.length; i += chunkSize) {
      const chunk = txs.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    for (var i = 0; i < cpus; i++) {
      const worker = cluster.fork();
      worker.send({ pkey: wallet.privateKey, txs: chunks[i] });
    }

    cluster.on("exit", (worker) => {
      console.log(`worker ${worker.process.pid} died`);
    });
  }
  main().catch((e) => console.log(e));
} else {
  async function main(_pkey, txs) {
    console.log("Worker", process.pid);
    const provider = new ethers.providers.JsonRpcProvider({
      url: "http://localhost:8777",
    });

    const receipts: any[] = [];
    for (const signedTx of txs) {
      receipts.push(await sendWithNonce(provider, signedTx));
    }

    console.log(receipts);

    for (const tx of receipts) {
      try {
        const receipt = await provider.waitForTransaction(tx, 1, 60000);
        console.log("TX OK", tx, receipt.blockNumber);
      } catch (e) {
        console.error(e);
        console.error("Timed out", tx);
      }
    }

    process.exit(0);
  }

  async function sendWithNonce(provider, tx) {
    const hash0 = await provider.sendTransaction(tx);
    return hash0.hash;
  }

  process.on("message", ({ pkey, txs }) => {
    main(pkey, txs).catch((e) => console.log(e));
  });
}

async function makeWithNonce(factory, wallet, nonce) {
  const req0 = factory.getDeployTransaction();
  req0.nonce = nonce;
  req0.gasLimit = GAS_LIMIT;
  req0.gasPrice = GAS_PRICE;

  return await wallet.signTransaction(req0);
}

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
