import axios from "axios";
import { expect } from "chai";
import { config, } from "./config";

const endpoint = config.apiUrl;
const testableUri = endpoint + "milkomeda";

const minValueToCheck = 10000000;
const milkomedaAddressToCheck = "addr_test1qq6gwl46frfwfk593pqjg39vym476s64n9cmykdl7lv7w32jdqlum6v4sc3l3w9nmuf3ean86n2y7pl83tpxl2qjdw8qmjljz2";

describe("/milkomeda", function() {
  it("should return list of all Milkomeda parameters", async() => {
    const result = await axios({method: "get", url: testableUri});

    expect(result.status).to.be.equal(200);
    expect(result.data).to.be.not.null;
  });
  it("should verify the payload", async() => {
    const result = await axios({method: "get", url: testableUri});

    expect(result.data.minimumValue).to.be.equal(minValueToCheck);
    expect(result.data.address).to.be.equal(milkomedaAddressToCheck);
    expect(result.data.tokensPerNetwork).to.be.ownProperty("internalTestnet");
    expect(result.data.tokensPerNetwork).to.be.ownProperty("publicMainnet");
    expect(result.data.tokensPerNetwork.internalTestnet.tokens).to.be.instanceOf(Array);
    expect(result.data.tokensPerNetwork.publicMainnet.tokens).to.be.instanceOf(Array);
  });
});
