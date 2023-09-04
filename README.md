# Ganache transaction bug reproduction

## Usage

1. Install dependencies: `yarn install`
2. In one terminal, start Ganache: `yarn run ts-node ganache.ts`
3. In another terminal, run the transaction submitter: `yarn run ts-node send.ts`

## Test scenario

This repo reproduces a bug in Ganache where transactions with manually-assigned nonces
become stuck in the `queued` TX pool state, when

- they are submitted by multiple processes concurrently.
- Ganache is in `instamine` mode.

`send.ts` generates a number of transactions with sequential nonces
(`TRANSACTIONS_PER_CPU`). It creates a random Ethereum keypair and signs each
transaction. It then shuffles the transactions randomly and splits them between
`N_CPUS` independent worker processes. Each process submits its transactions to
Ganache, and waits for a transaction receipt for each.

When `N_CPUS = 1` (no concurrency), all receipts return OK.

### Bug

On some runs, when `N_CPUS = 32`, or other high numbers, transactions will get
stuck in the txpool in the queued state.

The Ganache logs will show no activity except for `eth_blockNumber` and `eth_chainId`;
and `send.ts` will eventually exit.

Looking at the TX pool, you will see many queued transactions:

```
curl -X POST --data '{"jsonrpc":"2.0","method":"txpool_content","params":[], "id":1}' http://127.0.0.1:8888
```

The smallest nonce of the queued transactions will match the current `from` account
nonce; i.e. the nonce of the sender has been incremented correctly but queued transactions
have not been triggered and are stuck.
