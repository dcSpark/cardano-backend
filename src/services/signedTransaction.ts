import config from "config";
import axios from "axios";
import { Request, Response } from "express";

const submissionEndpoint :string = config.get("server.txSubmissionEndpoint");
const blockfrostAPIKey  :string = config.get("server.blockfrost_api_key");
//const contentTypeHeaders = {"Content-Type": "application/octet-stream"}; // THIS IS FOR CARDANO-WALLET, CBOR IS FOR CARDANO-SUBMIT-API (1.27.0).
const contentTypeHeaders = {
  "Content-Type": "application/cbor",
  "project_id": blockfrostAPIKey
  };

export const handleSignedTx = async (req: Request, res: Response): Promise<void> => {
  if (!req.body.signedTx)
    throw new Error("No signedTx in body");

  const buffer = Buffer.from(req.body.signedTx, "base64");
  const LOGGING_MSG_HOLDER: [any, any] = [null, null];
  try {
    const endpointResponse: any = await axios({
      method: "post"
      , url: submissionEndpoint
      , data: buffer
      , headers: contentTypeHeaders
    }).then(r => {
      try {
        const {status, statusText, data} = r || {};
        LOGGING_MSG_HOLDER[0] = `FULL: ${JSON.stringify({status, statusText, data})}`;
      } catch (e) {
        try {
          LOGGING_MSG_HOLDER[0] = `FULL_ERR: ${r} | ${e}`;
        } catch (ee) {
          LOGGING_MSG_HOLDER[0] = `FULL_ERR_ERR: ${ee}`;
        }
      }
      return r;
    }, err => {
      try {
        LOGGING_MSG_HOLDER[1] = `ERR: ${JSON.stringify(err)}`;
      } catch (e) {
        LOGGING_MSG_HOLDER[1] = `ERR_ERR: ${err}`;
      }
    });
    if (endpointResponse.status === 202) {
      if (endpointResponse.data.Left) {
        const msg = `Transaction was rejected: ${endpointResponse.data.Left}`;
        console.log("signedTransaction request body: " + req.body.signedTx);
        throw Error(msg);
      }
      res.send([]);
      return;
    } else if (endpointResponse.status === 400){
      const msg = `Bad Request: ${endpointResponse.data.Left}`;
      throw Error(msg);

    } else if (endpointResponse.status === 403){
      const msg = `Auth Secret is Missing: ${endpointResponse.data.Left}`;
      throw Error(msg);

    }else if (endpointResponse.status === 404){
      const msg = `Component Not Found: ${endpointResponse.data.Left}`;
      throw Error(msg);

    }else if (endpointResponse.status === 418){
      const msg = `IP has been auto-banned for extensive requests after limit reached: ${endpointResponse.data.Left}`;
      throw Error(msg);

    }
    else if (endpointResponse.status === 425){
      const msg = `Mempool is already full, not accepting net TXs: ${endpointResponse.data.Left}`;
      throw Error(msg);

    }else if (endpointResponse.status === 429){
      const msg = `Usage Limit Reached: ${endpointResponse.data.Left}`;
      throw Error(msg);

    }
    else {
      const {status, statusText, data} = endpointResponse || {};
      throw Error(`I did not understand the response from the submission endpoint: ${JSON.stringify({
        status,
        statusText,
        data
      })}`);
    }
  } catch (error: any) {
    const msg = `Error trying to send transaction: ${error} - ${JSON.stringify(LOGGING_MSG_HOLDER)}`;
    throw Error(msg);
  }
};
