import http from "http";
import express from "express";
import { Request, Response } from "express";

import axios from 'axios';

import * as _ from 'lodash';

import { applyMiddleware, applyRoutes, contentTypeHeaders, graphqlEndpoint, Route } from "./utils";
import * as utils from "./utils";
import * as middleware from "./middleware";

import { askBestBlock } from "./services/bestblock";
import { askUtxoForAddresses } from "./services/utxoForAddress";
import { askBlockNumByHash, askBlockNumByTxHash, askTransactionHistory } from "./services/transactionHistory";
import { askFilterUsedAddresses } from "./services/filterUsedAddress";
import { askUtxoSumForAddresses } from "./services/utxoSumForAddress";


const router = express();

const middlewares = [ middleware.handleCors
                    , middleware.handleBodyRequestParsing 
                    , middleware.handleCompression 
                    ];

applyMiddleware(middlewares, router);

const port = 8082;
const addressesRequestLimit = 50;
const apiResponseLimit = 50; 

const bestBlock = async (req: Request, res: Response) => {
  const result = await askBestBlock();
  switch(result.kind) {
    case "ok":
      const cardano = result.value;
      res.send({
        epoch: cardano.currentEpoch.number,
        slot: cardano.slotDuration,
        hash: cardano.currentEpoch.blocks[0].hash,
        height: cardano.blockHeight,
      });

      return;
    case "error":
      console.log(result.errMsg);
      return;
    default: return utils.assertNever(result);
  };
};

const utxoForAddresses = async (req: Request, res: Response) => {
  if(!req.body || !req.body.addresses) {
      console.log("error, no addresses.");
      return;
  }
  const verifiedAddresses = utils.validateAddressesReq(addressesRequestLimit
                                                      , req.body.addresses);
  switch(verifiedAddresses.kind){
      case "ok": 
          const result = await askUtxoForAddresses(verifiedAddresses.value);
          switch(result.kind)
          {
            case "ok":
              const utxos = result.value.map( utxo => 
                                            ({
                                              utxo_id: `${utxo.txHash}:${utxo.index}`,
                                              tx_hash: utxo.txHash,
                                              tx_index: utxo.index,
                                              receiver: utxo.address,
                                              amount: utxo.value,
                                              block_num: utxo.transaction.block.number,
                                            }));
              res.send(utxos);
              return;
            case "error":
              console.log(result.errMsg);
              return;
            default: return utils.assertNever(result);

          }
      case "error":
          console.log(verifiedAddresses.errMsg);
          return;
      default: return utils.assertNever(verifiedAddresses);
  }
};


const filterUsedAddresses = async (req: Request, res: Response) => {
  if(!req.body || !req.body.addresses) {
      console.log("error, no addresses.");
      return;
  }
  const verifiedAddresses = utils.validateAddressesReq(addressesRequestLimit
                                                      , req.body.addresses);
  switch(verifiedAddresses.kind){
      case "ok": 
          const result = await askFilterUsedAddresses(verifiedAddresses.value);
          switch(result.kind){
            case "ok":
              const usedAddresses = _.chain(result.value)
                                     .flatMap(tx => [...tx.inputs, ...tx.outputs])
                                     .map('address')
                                     .intersection(verifiedAddresses.value)
                                     .value();

              res.send(usedAddresses);
              return;
            case "error":
              console.log(result.errMsg);
              return;
            default: return utils.assertNever(result);
          }
          return;
      case "error":
          console.log(verifiedAddresses.errMsg);
          return;
      default: return utils.assertNever(verifiedAddresses);
  }
};



const utxoSumForAddresses = async (req:  Request, res:Response) => {
  if(!req.body || !req.body.addresses) {
      console.log("error, no addresses.");
      return;
  }
  const verifiedAddresses = utils.validateAddressesReq(addressesRequestLimit
                                                      , req.body.addresses);
  switch(verifiedAddresses.kind){
      case "ok": 
          const result = await askUtxoSumForAddresses(verifiedAddresses.value);
          switch(result.kind) {
            case "ok":
              res.send({ sum: result.value });
              return;
            case "error":
              console.log(result.errMsg);
              return;
            default: return utils.assertNever(result);  
          }
          return;
      case "error":
          console.log(verifiedAddresses.errMsg);
          return;
      default: return utils.assertNever(verifiedAddresses);
  }
};

const txHistory = async (req: Request, res: Response) => {
    if(!req.body){
        console.log("error, no body");
        return;
    }
    const verifiedBody = utils.validateHistoryReq(addressesRequestLimit, apiResponseLimit, req.body);
    switch(verifiedBody.kind){
        case "ok":
            const body = verifiedBody.value;
            const limit = body.limit || apiResponseLimit;
            const [referenceTx, referenceBlock] = (body.after && [body.after.tx, body.after.block]) || [];
            const referenceBestBlock = body.untilBlock;

            const untilBlockNum = await askBlockNumByHash(referenceBestBlock);
            const afterBlockNum = await askBlockNumByTxHash(referenceTx );
            const maybeTxs = await askTransactionHistory(limit, body.addresses, afterBlockNum, untilBlockNum);
            switch(maybeTxs.kind) {
              case "ok":
                const txs = maybeTxs.value.map( tx => ({
                    hash: tx.id,
                    is_reference: tx.id === referenceTx,
                    tx_state: 'Successful', // graphql doesn't handle pending/failed txs
                    last_update: tx.includedAt,
                    block_num: tx.block.number,
                    block_hash: tx.block.hash,
                    time: tx.includedAt,
                    epoch: tx.block.epochNo,
                    slot: tx.block.slotNo,
                    inputs: tx.inputs,
                    outputs: tx.outputs
                }));
                const refs = txs.filter( ({ is_reference }) => is_reference );

                if(referenceTx !== undefined){
                    if(refs.length !== 1){
                        console.log(`
                         graphql response with ${refs.length} rows for 
                         refTx ${referenceTx} and refBestBlock ${referenceBestBlock}`);
                        return;
                    }

                    const { block_num: reference_block_height, hash, block_hash, tx_state } = refs[0];
                    if (!hash) {
                      console.log(`Reference transaction '${referenceTx}' is not found!`);
                      return;
                    }
                    if (block_hash !== referenceBlock) {
                      console.log(`
                        Reference block '${referenceBlock}' for reference tx 
                        '${referenceTx}' not match real block '${block_hash}' 
                        (reference status is '${tx_state}')!`);
                      return;
                    }
                    if (!reference_block_height) {
                      console.log(`
                        Reference bestblock '${referenceBestBlock}' does not 
                        exist in the history!`);
                      return;
                    }
                }
                res.send(txs);
                return;
              case "error":
                console.log(maybeTxs.errMsg);
                return;
              default: return utils.assertNever(maybeTxs);
            }
            return;
        case "error":
            console.log(verifiedBody.errMsg);
            return;
        default: return utils.assertNever(verifiedBody);
    }
};

const routes : Route[] = [ { path: '/bestblock'
                 , method: "get"
                 , handler: bestBlock
                 }
               , { path: '/addresses/filterUsed'
                 , method: "post"
                 , handler: filterUsedAddresses
                 }
               , { path: '/txs/utxoForAddresses'
                 , method: "post"
                 , handler: utxoForAddresses
                 }
               , { path: '/txs/utxoSumForAddresses'
                 , method: "post"
                 , handler: utxoSumForAddresses
                 }
               , { path: '/txs/history'
                 , method: "post"
                 , handler: txHistory 
                 }
               ]

applyRoutes(routes, router);

const server = http.createServer(router);

server.listen(port, () =>
    console.log(`listening on ${port}...`)
);

