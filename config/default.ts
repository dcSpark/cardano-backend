export default { 
  db: {
    user: process.env.POSTGRES_USER || "",
    host: process.env.POSTGRES_HOST || "/var/run/postgresql",
    database: process.env.POSTGRES_DB || "cexplorer",
    password: process.env.POSTGRES_PASSWORD || ""
  },
  maxTimeHealthCheck: {
    minutes: 2,
    seconds: 30
  },
  server: {
    cardano_network: process.env.CARDANO_NETWORK || "mainnet",
    blockfrost_api_key: process.env.BLOCKFROST_API_KEY || "",
    addressRequestLimit: 50,
    apiResponseLimit: 50,
    priceFeed: process.env.priceURL || "http://localhost:8090/v1/getPrice",
    txSubmissionEndpoint: process.env.TX_SUBMISSION_ENDPOINT || "https://backend.yoroiwallet.com/api/submit/tx",
    txSubmissionEndpointKey: process.env.TX_SUBMISSION_ENDPOINT_KEY || "",
    smashEndpoint: process.env.SMASH_ENDPOINT || "https://smash.yoroiwallet.com/api/v1/metadata/",
    port: process.env.PORT || 8082,
    txsHashesRequestLimit: 150
  }
};