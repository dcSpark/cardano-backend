export default {
  db: {
    user: process.env.POSTGRES_USER || "",
    host: process.env.POSTGRES_HOST || "/var/run/postgresql",
    database: process.env.POSTGRES_DB || "cexplorer",
    password: process.env.POSTGRES_PASSWORD || "",
  },
  maxTimeHealthCheck: {
    minutes: 3,
    seconds: 10,
  },
  server: {
    addressRequestLimit: 50,
    // make limit as 500 as it works well upto 500 for mock txs
    transactionRequestLimit: 500,
    apiResponseLimit: 50,
    priceFeed: process.env.priceURL || "http://localhost:8090/v1/getPrice",
    tokenInfoFeed:
      process.env.tokenInfoURL || "http://localhost:8091/v1/getTokenInfo",
    fingerprintInfoFeed:
      process.env.fingerprintInfoUrl || "http://localhost:8091/v1/getFingerprintInfo",
    txSubmissionEndpoint:
      process.env.TX_SUBMISSION_ENDPOINT ||
      "https://cardano-mainnet.blockfrost.io/api/v0/tx/submit",
    signedTxQueueEndpoint:
      process.env.SIGNED_TX_QUEUE_ENDPOINT || "http://localhost:3030/",
    smashEndpoint:
      process.env.SMASH_ENDPOINT ||
      "https://smash.yoroiwallet.com/api/v1/metadata/",
    port: process.env.PORT || 8082,
    txsHashesRequestLimit: 150,
  },
  blockfrostProjectKey: process.env.BLOCKFROST || "",
  safeBlockDifference: process.env.SAFE_BLOCK_DIFFERENCE || "10",
  usingQueueEndpoint: process.env.USE_SIGNED_TX_QUEUE || "false",
};
