import { Request, Response } from "express";
import config from "config";

type Token = {
    name: string
    policyId: string
}

type MilkomedaConfig = {
    minimumVal: number,
    address: string,
    tokensPerNetwork: {
      internalTestnet: Token[],
      publicMainnet: Token[],
    }
};

/**
 * Handler for retrieving configuration values set inside config file for Milkomeda
 * @returns configuration based on @MilkomedaConfig type. 
 */
export const getMilkomedaInfo = () => async (req: Request, res: Response) => {

  let milkomedaInfo!: MilkomedaConfig;
  try {
    milkomedaInfo = config.get<MilkomedaConfig>("milkomeda");
  } catch (error: unknown) {
    throw new Error(`There was a problem with reading milkomeda config information. ${error}`);
  }

  if (!milkomedaInfo) {
    res.status(400).send("MilkomedaInfo is undefined or null");
    return;
  } 
  res.send(milkomedaInfo);
  return;

};
