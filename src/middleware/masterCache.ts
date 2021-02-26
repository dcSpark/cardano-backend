// eslint-disable-next-line
import config from "config";
import {BlockCreatedTrigger, UtxoCreatedTrigger, YoroiGeneralCache} from "../Transactions/types";
import {PoolConfig} from "pg";

// eslint-disable-next-line
const createSubscriber = require('pg-listen');
const cluster = require('cluster');

export const runDBSubscriptionIfMaster = (databaseLogin: PoolConfig, yoroiCache: YoroiGeneralCache): void => {
    if (!yoroiCache.isGeneralCacheActive || !cluster.isMaster) return;

    // Database Subscriptions
    const subscriber = createSubscriber(
        { user: config.get("db.user")
            , host: config.get("db.host")
            , database: config.get("db.database")
            , password: config.get("db.password")}
    );

    subscriber.notifications.on('block_created', (block: BlockCreatedTrigger) => {
        if(Object.values(block).some(e => (e == null))) {
            console.log("block_created::trigger has a null value ", block);
            return;
        }

        processBlockForCache(block, yoroiCache)
    });

    subscriber.notifications.on('epoch_created', (epoch: any) => {
        if(Object.values(epoch).some(e => (e == null))) {
            console.log("epoch_created::trigger has a null value ", epoch);
            return;
        }

        processEpochForCache(epoch, yoroiCache)
    });

    subscriber.notifications.on('utxo_created', (utxo: UtxoCreatedTrigger) => {
        if(Object.values(utxo).some(e => (e == null))) {
            console.log("utxo_created::trigger has a null value ", utxo);
            return;
        }

        processEpochForCache(utxo, yoroiCache)
    });

    (async () => {
        await subscriber.connect();
        await subscriber.listenTo('block_created');
        await subscriber.listenTo('epoch_created');
        await subscriber.listenTo('utxo_created');
    })();
}

const processEpochForCache = (epoch: any, yoroiCache: YoroiGeneralCache): void => {
    // Invalidate AccountStateCache if exist
    if (yoroiCache.accountStateLruCache) {
        yoroiCache.accountStateLruCache.reset();
    }
}

const processUtxoForCache = (utxo: UtxoCreatedTrigger, yoroiCache: YoroiGeneralCache): void => {
    // Invalidate UTXO Caches if exist
    if (yoroiCache.transactionHistoryLruCache) {
        yoroiCache.transactionHistoryLruCache.del(utxo.address)
    }
}

const processBlockForCache = (block: BlockCreatedTrigger, yoroiCache: YoroiGeneralCache): void => {
    // endpoints to invalidate cache
    // bestblock
    // txHistory
    // accountState
}