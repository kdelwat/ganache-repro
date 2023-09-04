import { ContractFactory, Wallet, ethers } from "ethers";

const GAS_LIMIT: number = 173980512; // Determined experimentally to cover all our transactions
const GAS_PRICE: number = 0; // Geora nodes have a gas price of 0
async function main() {
  const provider = new ethers.providers.JsonRpcProvider({
    url: "http://localhost:8777",
  });

  const wallet = Wallet.createRandom();

  const bytecode =
    "0x608060405234801561001057600080fd5b5060f78061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80633fb5c1cb1460415780638381f58a146053578063d09de08a14606d575b600080fd5b6051604c3660046083565b600055565b005b605b60005481565b60405190815260200160405180910390f35b6051600080549080607c83609b565b9190505550565b600060208284031215609457600080fd5b5035919050565b60006001820160ba57634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212207ee2e4d9c3228f7d7bcd3dd9ffc5b67584fcf338cbd4189e30d5e65b747590cd64736f6c634300080d0033";

  const factory = new ContractFactory([], bytecode, wallet);

  const txs: string[] = [];

  for (let i = 10000; i >= 0; i--) {
    txs.push(await sendWithNonce(provider, factory, wallet, i));
  }

  console.log(txs);

  for (const tx of txs) {
    try {
      const receipt = await provider.waitForTransaction(tx, 1, 60000);
      console.log("TX OK", tx, receipt.blockNumber);
    } catch {
      console.error("Timed out", tx);
    }
  }
}

async function sendWithNonce(provider, factory, wallet, nonce) {
  const req0 = factory.getDeployTransaction();
  req0.nonce = nonce;
  req0.gasLimit = GAS_LIMIT;
  req0.gasPrice = GAS_PRICE;

  const signed0 = await wallet.signTransaction(req0);
  const hash0 = await provider.sendTransaction(signed0);
  return hash0.hash;
}

main().catch((e) => console.log(e));
