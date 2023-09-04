import ganache = require("ganache");
import * as ethers from "ethers";

async function main() {
  const options: ganache.ServerOptions<"ethereum"> = {
    gasPrice: 0,
    gasLimit: Number.MAX_SAFE_INTEGER,
    allowUnlimitedContractSize: true,
    vmErrorsOnRPCResponse: false, // Consistent with Besu
    hardfork: "berlin",
    chain: {
      asyncRequestProcessing: true,
    },
    logging: {
      verbose: false,
    },
    miner: {
      instamine: "strict",
    },
  };

  // @ts-ignore
  const server = ganache.server(options);

  server.listen(8777, function () {
    console.log(`Ethereum RPC listening on port 8777`);

    // @ts-ignore
    const provider = new ethers.providers.Web3Provider(server.provider);
    provider.pollingInterval = 100;

    provider.on("block", async (n) => {
      const block = await provider.getBlock(n);
      console.log(block);
    });
  });
}

main().catch((e) => console.log(e));
