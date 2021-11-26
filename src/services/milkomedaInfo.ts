import { Request, Response } from "express";
import config from "config";
import { NetworkNames } from "@dcspark/milkomeda-constants/types";

type NetworkToken = {
  name: NetworkNames,
  tokens: Token[]
}

type Token = {
    tokenName: string
    policyId: string
}

type MilkomedaConfig = {
    minimumValue: number,
    address: string, // address as string in bech32
    tokensPerNetwork: NetworkToken[]
};

/**
 * Handler for retrieving configuration values set inside config file for Milkomeda
 * @returns configuration based on @MilkomedaConfig type. 
 */
export const getMilkomedaInfo = () => async (req: Request, res: Response) => {

  const milkomedaInfo = getConfig("milkomeda") as MilkomedaConfig;
  if (milkomedaInfo instanceof Error) {
    throw milkomedaInfo;
  } 
  res.send({ minimumValue: milkomedaInfo.minimumValue, address: milkomedaInfo.address });
  return;

};

/**
 * Handler for retrieving Milkomeda tokens for a given network
 * @returns configuration based on @MilkomedaConfig type. 
 */
 export const getMilkomedaTokensByNetwork = () => async (req: Request, res: Response) => {
  const networks = getConfig("milkomeda.tokensPerNetwork") as NetworkToken[];
  if (networks instanceof Error) {
    throw networks;
  }

  switch (req.params.network) {
    case NetworkNames.internalTestnet:
      res.send(getNetworkTokens(networks, NetworkNames.internalTestnet));
      break;
    default:
      res.status(404).send(`List of tokens for ${req.params.network} was not found`);
      break;
  }
};

const getConfig = (params: string) => {
  let milkomedaInfo!: MilkomedaConfig | NetworkToken[] | Error;
  try {
    milkomedaInfo = config.get(params);
  } catch (error: unknown) {
    milkomedaInfo = new Error(`There was a problem with reading milkomeda config information. ${error}`);
  }
  return milkomedaInfo;
};

const getNetworkTokens = (networks: NetworkToken[], networkName: NetworkNames) => {
    return networks.filter(n => n.name.toString().includes(networkName.toString()))[0]; // one list per deployment so always first element
};