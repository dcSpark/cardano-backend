import config from "config";
import http from "http";
import express from "express";
import * as websockets from "ws";
import axios from "axios";
import { Request, Response } from "express";

import { Pool } from "pg";
import { getTokenInfoHandler } from "./token-registry/getTokenInfo";
import { getFingerprintInfoHandler } from "./token-registry/getFingerprintInfo";

// eslint-disable-next-line
const semverCompare = require("semver-compare");

import { connectionHandler } from "./ws-server";
import {
  applyMiddleware,
  applyRoutes,
  Route,
  UtilEither,
  errMsgs,
} from "./utils";
import * as utils from "./utils";
import * as middleware from "./middleware";

import { askBestBlock } from "./services/bestblock";
import { utxoForAddresses } from "./services/utxoForAddress";
import {
  askBlockNumByHash,
  askBlockNumByTxHash,
  askTransactionHistory,
} from "./services/transactionHistory";
import type { BlockNumByTxHashFrag } from "./services/transactionHistory";
import { filterUsedAddresses } from "./services/filterUsedAddress";
import { askUtxoSumForAddresses } from "./services/utxoSumForAddress";
import { handleSignedTx } from "./services/signedTransaction";
import { handlePoolInfo } from "./services/poolInfo";
import { handleGetAccountState } from "./services/accountState";
import { handleGetRegHistory } from "./services/regHistory";
import { handleGetRewardHistory } from "./services/rewardHistory";
import { handleGetMultiAssetSupply } from "./services/multiAssetSupply";
import { handleGetMultiAssetTxMintMetadata } from "./services/multiAssetTxMint";
import { handleTxStatus } from "./services/txStatus";
import { handleGetTxIO, handleGetTxOutput } from "./services/txIO";
import { handleTipStatusGet, handleTipStatusPost } from "./services/tipStatus";
import { handleGetTransactions } from "./services/transactions";

import { handlePolicyIdExists } from "./services/policyIdExists";

import { HealthChecker } from "./HealthChecker";
import { askBehindBy } from "./services/healthCheckByTime";

import { createCertificatesView } from "./Transactions/certificates";
import { createTransactionOutputView } from "./Transactions/output";
import { createValidUtxosView } from "./Transactions/valid_utxos_view";
import { createTransactionUtilityFunctions } from "./Transactions/userDefinedFunctions";
import { poolDelegationHistory } from "./services/poolHistory";
import { handleGetCardanoWalletPools } from "./services/cardanoWallet";
import { utxoForTransaction } from "./services/utxoForTransaction";

import { mapTransactionFragsToResponse } from "./utils/mappers";

import promBundle = require("express-prom-bundle");

const TX_HISTORY_API_VERSION = 1;
// this should be as per the release
const FLINT_VERSION_WITH_API_VERSION_SUPPORT = "1.8.4";

// for config see: https://www.npmjs.com/package/express-prometheus-middleware
const metricsMiddleware = promBundle({
  includeStatusCode: true,
  includeMethod: true,
  includePath: true,
  metricType: "summary",
  percentiles: [0.5, 0.9, 0.99],
  // TODO: consider do we need these?
  // promClient: {
  //   collectDefaultMetrics: {}
  // },
  customLabels: {
    app: "cardano-backend",
    version: process.env.version,
  },
  // maxAgeSeconds: 120,
  // ageBuckets: 2,
});

const pool = new Pool({
  user: config.get("db.user"),
  host: config.get("db.host"),
  database: config.get("db.database"),
  password: config.get("db.password"),
});
createCertificatesView(pool);
createValidUtxosView(pool);
createTransactionOutputView(pool);
createTransactionUtilityFunctions(pool);

const healthChecker = new HealthChecker(() => askBestBlock(pool));

const router = express();

const middlewares = [
  middleware.handleCors,
  middleware.handleBodyRequestParsing,
  middleware.handleCompression,
  middleware.handleTiming,
];

applyMiddleware(middlewares, router);

const port: number = config.get("server.port");
const addressesRequestLimit: number = config.get("server.addressRequestLimit");
const apiResponseLimit: number = config.get("server.apiResponseLimit");

const bestBlock = (pool: Pool) => async (_req: Request, res: Response) => {
  const result = await askBestBlock(pool);
  switch (result.kind) {
    case "ok": {
      const cardano = result.value;
      res.send(cardano);
      return;
    }
    case "error":
      throw new Error(result.errMsg);
    default:
      return utils.assertNever(result);
  }
};

const price = async (req: Request, res: Response) => {
  const apiURL: string = config.get("server.priceFeed");

  axios({
    url: apiURL,
    method: "post",
    data: req.body,
  }).then((resp) => {
    if (resp.status === 500) {
      res
        .status(500)
        .send("Problem with the pricing API server. Server error.");
    } else if (resp.status === 400) {
      res
        .status(400)
        .send("Problem with the pricing API server. Request issue.");
    } else {
      res.send(resp.data);
      return;
    }
  });
};

const utxoSumForAddresses = async (req: Request, res: Response) => {
  if (!req.body || !req.body.addresses) {
    throw new Error("error, no addresses.");
  }
  const verifiedAddresses = utils.validateAddressesReq(
    addressesRequestLimit,
    req.body.addresses
  );
  switch (verifiedAddresses.kind) {
    case "ok": {
      const result = await askUtxoSumForAddresses(
        pool,
        verifiedAddresses.value
      );
      switch (result.kind) {
        case "ok":
          res.send(result.value);
          return;
        case "error":
          throw new Error(result.errMsg);
        default:
          return utils.assertNever(result);
      }
    }
    case "error":
      throw new Error(verifiedAddresses.errMsg);
    default:
      return utils.assertNever(verifiedAddresses);
  }
};

const getOrDefaultAfterParam = (
  result: UtilEither<BlockNumByTxHashFrag>
): {
  blockNumber: number;
  txIndex: number;
} => {
  if (result.kind !== "ok") {
    if (result.errMsg === errMsgs.noValue) {
      // default value since this is an optional field
      return {
        blockNumber: -1,
        txIndex: -1,
      };
    }
    throw new Error(result.errMsg);
  }
  return {
    blockNumber: result.value.block.number,
    txIndex: result.value.blockIndex,
  };
};

const txHistory = async (req: Request, res: Response) => {
  if (!req.body) {
    throw new Error("error, no body");
  }
  const verifiedBody = utils.validateHistoryReq(
    addressesRequestLimit,
    apiResponseLimit,
    req.body
  );
  switch (verifiedBody.kind) {
    case "ok": {
      const body = verifiedBody.value;
      const limit = body.limit || apiResponseLimit;
      const [referenceTx, referenceBlock] =
        (body.after && [body.after.tx, body.after.block]) || [];
      const referenceBestBlock = body.untilBlock;
      const untilBlockNum = await askBlockNumByHash(pool, referenceBestBlock);
      const afterBlockInfo = await askBlockNumByTxHash(pool, referenceTx);

      if (
        untilBlockNum.kind === "error" &&
        untilBlockNum.errMsg === utils.errMsgs.noValue
      ) {
        throw new Error("REFERENCE_BEST_BLOCK_MISMATCH");
      }
      if (
        afterBlockInfo.kind === "error" &&
        typeof referenceTx !== "undefined"
      ) {
        throw new Error("REFERENCE_TX_NOT_FOUND");
      }

      if (
        afterBlockInfo.kind === "ok" &&
        afterBlockInfo.value.block.hash !== referenceBlock
      ) {
        throw new Error("REFERENCE_BLOCK_MISMATCH");
      }

      // when things are running smoothly, we would never hit this case case
      if (untilBlockNum.kind !== "ok") {
        throw new Error(untilBlockNum.errMsg);
      }
      const afterInfo = getOrDefaultAfterParam(afterBlockInfo);

      const maybeTxs = await askTransactionHistory(
        pool,
        limit,
        body.addresses,
        afterInfo,
        untilBlockNum.value
      );
      switch (maybeTxs.kind) {
        case "ok": {
          const txs = mapTransactionFragsToResponse(maybeTxs.value);

          if (req.headers?.["flint-version"]) {
            const userFlintVersion = req.headers?.["flint-version"];

            // https://github.com/substack/semver-compare
            const flintSupportsApiVersion = semverCompare(
              userFlintVersion,
              FLINT_VERSION_WITH_API_VERSION_SUPPORT
            );
            // if userFlintVersion >=  FLINT_VERSION_WITH_API_VERSION_SUPPORT
            if (flintSupportsApiVersion >= 0) {
              res.send({ txs, version: TX_HISTORY_API_VERSION });
              return;
            }
          }
          res.send(txs);
          return;
        }
        case "error":
          throw new Error(maybeTxs.errMsg);
        default:
          return utils.assertNever(maybeTxs);
      }
    }
    case "error":
      throw new Error(verifiedBody.errMsg);
    default:
      return utils.assertNever(verifiedBody);
  }
};

const getStatus = async (req: Request, res: Response) => {
  const mobilePlatformVersionPrefixes = ["android / ", "ios / ", "- /"];
  const desktopPlatformVersionPrefixes = ["firefox / ", "chrome / "];
  const clientVersionHeader = "flint-version";
  if (clientVersionHeader in req.headers) {
    const rawVerString: string | string[] | undefined =
      req.headers[clientVersionHeader];
    let verString = "none / 0.0.0";
    if (typeof rawVerString === "string") verString = rawVerString;
    if (Array.isArray(rawVerString)) verString = rawVerString[0];

    for (const prefix of mobilePlatformVersionPrefixes) {
      if (verString.includes(prefix)) {
        // const simVer = verString.split(" / ")[1];
        // if (semverCompare(simVer, minMobileVersion) < 0){
        //   res.send({ isServerOk: true
        //     , isMaintenance: true });
        //   return;
        // }
      }
    }
    for (const prefix of desktopPlatformVersionPrefixes) {
      if (verString.includes(prefix)) {
        // const simVer = verString.split(" / ")[1];
        // if (semverCompare(simVer, minDesktopVersion) < 0){
        //   res.send({ isServerOk: true
        //     , isMaintenance: true });
        //   return;
        // }
      }
    }
  }
  res.send({
    isServerOk: true,
    isMaintenance: false,
    serverTime: Date.now(),
    version: process.env.version,
  });
};

const getFundInfo = async (req: Request, res: Response) => {
  res.send({
    currentFund: {
      id: 7,
      registrationStart: "2021-11-18T11:00:00Z",
      registrationEnd: "2022-01-13T11:00:00Z",
      votingStart: "2022-01-13T11:00:00Z",
      votingEnd: "2022-01-27T11:00:00Z",
      votingPowerThreshold: "450",
    },
  });
};

const routes: Route[] = [
  // deprecated endpoints
  {
    path: "/getAccountState",
    method: "post",
    handler: handleGetAccountState(pool),
  },
  {
    path: "/getRegistrationHistory",
    method: "post",
    handler: handleGetRegHistory(pool),
  },
  {
    path: "/getRewardHistory",
    method: "post",
    handler: handleGetRewardHistory(pool),
  },
  { path: "/getPoolInfo", method: "post", handler: handlePoolInfo(pool) },
  // replacement endpoints
  {
    path: "/account/state",
    method: "post",
    handler: handleGetAccountState(pool),
  },
  {
    path: "/account/registrationHistory",
    method: "post",
    handler: handleGetRegHistory(pool),
  },
  {
    path: "/account/rewardHistory",
    method: "post",
    handler: handleGetRewardHistory(pool),
  },
  { path: "/pool/info", method: "post", handler: handlePoolInfo(pool) },
  { path: "/getPrice", method: "post", handler: price },
  { path: "/getTokenInfo", method: "post", handler: getTokenInfoHandler },
  { path: "/getFingerprintInfo", method: "post", handler: getFingerprintInfoHandler },
  {
    path: "/pool/delegationHistory",
    method: "post",
    handler: poolDelegationHistory(pool),
  },
  // regular endpoints
  { path: "/v2/bestblock", method: "get", handler: bestBlock(pool) },
  { path: "/v2/tipStatus", method: "get", handler: handleTipStatusGet(pool) },
  { path: "/v2/tipStatus", method: "post", handler: handleTipStatusPost(pool) },
  {
    path: "/v2/addresses/filterUsed",
    method: "post",
    handler: filterUsedAddresses(pool),
  },
  {
    path: "/txs/utxoForAddresses",
    method: "post",
    handler: utxoForAddresses(pool),
  },
  {
    path: "/txs/utxoForTransactions",
    method: "post",
    handler: utxoForTransaction(pool),
  },
  {
    path: "/txs/utxoSumForAddresses",
    method: "post",
    handler: utxoSumForAddresses,
  },
  { path: "/v2/txs/history", method: "post", handler: txHistory },
  { path: "/txs/io/:tx_hash", method: "get", handler: handleGetTxIO(pool) },
  {
    path: "/txs/io/:tx_hash/o/:index",
    method: "get",
    handler: handleGetTxOutput(pool),
  },
  { path: "/v2/txs/get", method: "post", handler: handleGetTransactions(pool) },
  { path: "/txs/signed", method: "post", handler: handleSignedTx },
  {
    path: "/pool/cardanoWallet",
    method: "get",
    handler: handleGetCardanoWalletPools(pool),
  },
  {
    path: "/multiAsset/supply",
    method: "post",
    handler: handleGetMultiAssetSupply(pool),
  },
  {
    path: "/multiAsset/metadata",
    method: "post",
    handler: handleGetMultiAssetTxMintMetadata(pool),
  },
  {
    path: "/tx/status",
    method: "post",
    handler: handleTxStatus(pool),
  },
  {
    path: "/multiAsset/policyIdExists",
    method: "post",
    handler: handlePolicyIdExists(pool),
  },
  {
    path: "/v2/importerhealthcheck",
    method: "get",
    handler: async (_req: Request, res: Response) => {
      const status = healthChecker.getStatus();
      if (status === "OK") res.send({ code: 200, message: "Importer is OK" });
      else if (status === "BLOCK_IS_STALE")
        res.send({
          code: 200,
          message:
            "Importer seems OK. Not enough time has passed since last valid request.",
        });
      else throw new Error(status);
    },
  },
  {
    path: "/v2/healthcheckbytime",
    method: "get",
    handler: async (_req: Request, res: Response) => {
      const response = await askBehindBy(pool);
      if (response.kind === "ok") {
        const maxSeconds: number = config.get("maxTimeHealthCheck.seconds");
        const maxMinutes: number = config.get("maxTimeHealthCheck.minutes");
        const totalMaxTime = maxMinutes * 60 + maxSeconds;

        const behindBy = response.value.behindby;

        if (behindBy - totalMaxTime > 0) {
          res.status(503).send({ behindBy, isOK: "False" });
        } else {
          res.send({ behindBy, isOK: "True" });
        }
      } else {
        res.status(503).send({ errMsg: response.errMsg, isOK: "False" });
        //throw new Error(response.errMsg);
      }
    },
  },
  { path: "/status", method: "get", handler: getStatus },
  {
    path: "/v0/catalyst/fundInfo",
    method: "get",
    handler: getFundInfo,
  },
];
router.use(metricsMiddleware);
applyRoutes(routes, router);
router.use(middleware.logErrors);
router.use(middleware.errorHandler);

const server = http.createServer(router);

const wss = new websockets.Server({ server });
wss.on("connection", connectionHandler(pool));

server.listen(port, () => console.log(`listening on ${port}...`));
