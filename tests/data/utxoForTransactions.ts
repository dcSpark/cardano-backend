export const utxoForTransactionsRequest = [
  {
    txHash: "7775d5e094b3660cae2464da5ba029134bfa9ca410cc3c7198d23731855bc3d0",
    index: 0,
  },
  {
    txHash: "00001781e639bdf53cdac97ebbaf43035b35ce59be9f6e480e7b46dcd5c67028",
    index: 4,
  },
];

export const utxoForTransactionResponse = [
  {
    utxo_id:
      "7775d5e094b3660cae2464da5ba029134bfa9ca410cc3c7198d23731855bc3d0:0",
    tx_hash: "7775d5e094b3660cae2464da5ba029134bfa9ca410cc3c7198d23731855bc3d0",
    tx_index: 0,
    receiver:
      "addr1vyqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkdl5mw",
    amount: "1344798",
    assets: [{
      amount: "1",
      assetId: "db01dec7311778ad90b72627a38cd6ec61a298f964d2320b4a67c23b.564950",
      name: "564950",
      policyId: "db01dec7311778ad90b72627a38cd6ec61a298f964d2320b4a67c23b",
    }],
    block_num: 6347041,
  },
  {
    utxo_id:
      "00001781e639bdf53cdac97ebbaf43035b35ce59be9f6e480e7b46dcd5c67028:4",
    tx_hash: "00001781e639bdf53cdac97ebbaf43035b35ce59be9f6e480e7b46dcd5c67028",
    tx_index: 4,
    receiver: "Ae2tdPwUPEZBntoS6p4AhW6UmaoaT4Q2mHsUiyq3JBx5ptSYXiHMD5DNSWc",
    amount: "125387778",
    assets: [],
    block_num: 6750594,
  },
];
