import config from "config";
import axios from "axios";
import { Request, Response } from "express";
import { calculateTxId } from "../utils";

const submissionEndpoint: string = config.get("server.txSubmissionEndpoint");
const blockfrostProjectKey: string = config.get("blockfrostProjectKey");

// const contentTypeHeaders = {"Content-Type": "application/octet-stream"}; // THIS IS FOR CARDANO-WALLET, CBOR IS FOR CARDANO-SUBMIT-API (1.27.0).
const contentTypeHeaders = {
  "Content-Type": "application/cbor",
  "User-Agent": "flint-wallet",
  "Cache-Control": "no-cache",
  project_id: blockfrostProjectKey,
};

const submitToQueue = async (req: Request, res: Response) => {
  try {
    const buffer = Buffer.from(req.body.signedTx, "base64");
    const txId = await calculateTxId(buffer.toString("base64"));

    const signedTxQueueEndpoint = config.get("server.signedTxQueueEndpoint");

    await axios({
      method: "post",
      url: `${signedTxQueueEndpoint}api/submit/tx`,
      data: {
        txId: txId,
        signedTx: buffer.toString("base64"),
      },
      headers: contentTypeHeaders,
    });
    res.status(200).send({ txId });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error submitting the TX");
  }
};

const submit = async (req: Request, res: Response) => {
  const buffer = Buffer.from(req.body.signedTx, "base64");
  let LOGGING_MSG_HOLDER: null | string = null;
  let requestUrl = submissionEndpoint;
  const headers: Record<string, string> = { ...contentTypeHeaders };
  const isCustomNodeRequest = req.body.customNodeUrl;
  if (isCustomNodeRequest) {
    requestUrl = req.body.customNodeUrl;
    delete headers.project_id;
  }

  try {
    const endpointResponse: any = await axios({
      method: "post",
      url: requestUrl,
      data: buffer,
      headers,
    });

    if (endpointResponse.status === 200) {
      res.send([]);
      return;
    } else {
      if (isCustomNodeRequest) {
        LOGGING_MSG_HOLDER = JSON.stringify({
          endpointResponse,
        });
      } else {
        const { status } = endpointResponse || {};
        LOGGING_MSG_HOLDER = JSON.stringify({
          status,
          error: JSON.stringify(endpointResponse?.data ?? {}),
        });
      }

      throw Error(` Error from the submission endpoint: ${LOGGING_MSG_HOLDER}`);
    }
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response;
      LOGGING_MSG_HOLDER = JSON.stringify({
        status,
        data,
      });
    } else {
      LOGGING_MSG_HOLDER = `Error trying to send transaction:${JSON.stringify(
        error
      )}`;
    }

    throw Error(LOGGING_MSG_HOLDER);
  }
};

export const handleSignedTx = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!req.body.signedTx) throw new Error("No signedTx in body");

  if (config.get("usingQueueEndpoint") === "true") {
    await submitToQueue(req, res);
  } else {
    await submit(req, res);
  }
};
