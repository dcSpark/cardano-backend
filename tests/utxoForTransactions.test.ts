import { utxoForTransactionResponse, utxoForTransactionsRequest } from "./data/utxoForTransactions";
import axios from "axios";
import { expect } from "chai";

import { config } from "./config";

const endpoint = config.apiUrl;
const testingApi = "txs/utxoForTransactions";

describe(testingApi, function () {
  this.timeout(10000);
  it("should return expected results", async function () {
    const postData = { transactions: utxoForTransactionsRequest };
    const result = await axios.post(`${endpoint}${testingApi}`, postData);

    const resultData = [...result.data];
    resultData.sort((a: any, b: any) => {
      if (a.utxo_id < b.utxo_id) return 1;
      if (a.utxo_id === b.utxo_id) return 0;
      return -1;
    });
    expect(resultData).be.deep.eq(utxoForTransactionResponse);
  });
});
