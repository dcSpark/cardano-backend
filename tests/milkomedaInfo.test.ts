import axios from "axios";
import { expect } from "chai";
import { config, } from "./config";
import { NetworkNames } from "@dcspark/milkomeda-constants/types";

const endpoint = config.apiUrl;

const minValueToCheck = 10000000;
const milkomedaAddressToCheck = "addr_test1qq6gwl46frfwfk593pqjg39vym476s64n9cmykdl7lv7w32jdqlum6v4sc3l3w9nmuf3ean86n2y7pl83tpxl2qjdw8qmjljz2";

describe.only("/milkomeda endpoints check", function() {
  it("should return list of all Milkomeda parameters", async() => {
    const result = await axios({method: "get", url: endpoint + "milkomeda"});
    expect(result.status).to.be.equal(200);
    expect(result.data).to.be.not.null;
  });
  it("should verify Milkomeda parameters (no token list here)", async() => {
    const result = await axios({method: "get", url: endpoint + "milkomeda"});
    expect(result.data.minimumValue).to.be.equal(minValueToCheck);
    expect(result.data.address).to.be.equal(milkomedaAddressToCheck);
  });
  it("should verify payload of specific tokens for given network", async() => {
    const result = await axios({method: "get", url: `${endpoint}milkomeda/tokens/${NetworkNames.internalTestnet}`});
    expect(result.data.tokens).to.be.instanceOf(Array);
    expect(result.data.tokens[0].tokenName).to.be.equal("TADA");
  });
});
